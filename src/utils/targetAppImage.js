// Keep the complete multipart request small enough for common proxy limits.
const MAX_IMAGE_BYTES = 300 * 1024;
const MAX_DIMENSION = 1200;

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذر قراءة صورة التطبيق. اختر صورة أخرى.')); };
  image.src = url;
});

const encode = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('تعذر تجهيز صورة التطبيق. اختر صورة أخرى.')), 'image/webp', quality);
});

export const prepareTargetAppImage = async (file) => {
  const accepted = ['image/jpeg', 'image/png', 'image/webp'];
  if (!accepted.includes(file.type)) throw new Error('اختر صورة بصيغة JPG أو PNG أو WebP.');
  if (file.size <= MAX_IMAGE_BYTES && /\.(jpe?g|png|webp)$/i.test(file.name || '')) return file;

  const image = await loadImage(file);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error('تعذر قراءة أبعاد صورة التطبيق.');
  let scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('تعذر تجهيز صورة التطبيق في هذا المتصفح.');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await encode(canvas, attempt % 2 ? 0.65 : 0.8);
    if (blob.size <= MAX_IMAGE_BYTES && ['image/webp', 'image/png'].includes(blob.type)) {
      const extension = blob.type === 'image/webp' ? 'webp' : 'png';
      return new File([blob], `target-app.${extension}`, { type: blob.type });
    }
    if (attempt % 2) scale *= 0.7;
  }
  throw new Error('تعذر تقليل حجم الصورة. اختر صورة أصغر وحاول مرة أخرى.');
};
