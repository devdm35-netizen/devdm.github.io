import { useEffect } from "react";

export default function dropZone({ onFiles, hasImages }) {

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      onFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = (e) => {
    for (let item of e.clipboardData.items) {
      if (item.type.startsWith("image")) {
        onFiles([item.getAsFile()]);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  if (hasImages) return null;

  return (
    <div
      className="dropZone"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="dropText">
        <h2>📂 Arrastra tus imágenes aquí</h2>
        <p>o presiona Ctrl + V para pegar</p>
      </div>
    </div>
  );
}