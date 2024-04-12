function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(";base64,");
  const byteCharacters = atob(parts[1]);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return byteArray;
}

export { dataURLtoBlob };
