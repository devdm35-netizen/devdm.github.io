import { useState, useRef, useEffect, useMemo } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import "./App.css";

// Componente Photo
function Photo({ img, onDelete, width, height, guillotine }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: img.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${width}cm`,
    height: `${height}cm`,
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`photo ${guillotine ? "cutLines" : ""}`}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        className="dragHandle"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
        }}
      />

      {/* Botón eliminar */}
      <button
        className="deleteBtn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(img.id);
        }}
        style={{
          position: "absolute",
          top: "2px",
          right: "2px",
          zIndex: 10,
          pointerEvents: "auto",
        }}
      >
        ✕
      </button>

      <img src={img.url} alt="foto" style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

// Componente principal
export default function App() {
  const previewRef = useRef();
  const [ineMode, setIneMode] = useState(false);

  const [images, setImages] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [photoWidth, setPhotoWidth] = useState(3);
  const [photoHeight, setPhotoHeight] = useState(4);
  const [copies, setCopies] = useState(1);
  const [guillotine, setGuillotine] = useState(true);

  const SHEET_W = 21.6;
  const SHEET_H = 27.9;

  const cols = Math.max(1, Math.floor(SHEET_W / photoWidth));
  const rows = Math.max(1, Math.floor(SHEET_H / photoHeight));
  const perSheet = cols * rows;

  const maxPhotoWidth = SHEET_W / cols;
  const maxPhotoHeight = SHEET_H / rows;
  const safePhotoWidth = Math.min(photoWidth, maxPhotoWidth);
  const safePhotoHeight = Math.min(photoHeight, maxPhotoHeight);

  const sortedIds = useMemo(() => images.map(i => i.id), [images]);

  // agregar imágenes
  const addImages = (files) => {
    const newImgs = [];
    Array.from(files).forEach(file => {
      for (let i = 0; i < copies; i++) {
        newImgs.push({ id: crypto.randomUUID(), url: URL.createObjectURL(file) });
      }
    });
    setImages(prev => [...prev, ...newImgs]);
  };

  const handleUpload = (e) => addImages(e.target.files);

  const handlePaste = (e) => {
    for (let item of e.clipboardData.items) {
      if (item.type.startsWith("image")) addImages([item.getAsFile()]);
    }
  };

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [copies]);

  // borrar imagen
  const deleteImage = (id) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) {
        setUndoStack(stack => [...stack, img]); // guardar para Ctrl+Z
        // ⚠️ No revocamos el URL aquí
      }
      return prev.filter(i => i.id !== id);
    });
  };

  // drag
  const handleDragEnd = ({ active, over }) => {
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = images.findIndex(i => i.id === active.id);
      const newIndex = images.findIndex(i => i.id === over.id);
      setImages(arrayMove(images, oldIndex, newIndex));
    }
  };

  // exportar pdf
  const exportPDF = async () => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const sheetsDOM = previewRef.current.querySelectorAll(".sheet");

    for (let i = 0; i < sheetsDOM.length; i++) {
      const canvas = await html2canvas(sheetsDOM[i], { scale: 3 });
      const imgData = canvas.toDataURL("image/png");
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, 0, 216, 279);
    }
    pdf.save("fotos.pdf");
  };

  const cleanAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
    setUndoStack([]);
    setIneMode(false);
  };

  const sheetsArr = useMemo(() => {
    const sheets = [];
    for (let i = 0; i < images.length; i += perSheet) {
      sheets.push(images.slice(i, i + perSheet));
    }
    return sheets;
  }, [images, perSheet]);

  // borrar con Delete y deshacer con Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e) => {
      // borrar última imagen
      if (e.key === "Delete" && images.length > 0) {
        const last = images[images.length - 1];
        deleteImage(last.id);
      }

      // Ctrl + Z: deshacer
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (undoStack.length > 0) {
          const lastDeleted = undoStack[undoStack.length - 1];
          setUndoStack(stack => stack.slice(0, stack.length - 1));
          setImages(prev => [...prev, lastDeleted]); // restaurar imagen
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images, undoStack]);

  // preset infantil
  const presetInfantil = (num) => {
    if (images.length === 0) return;
    const base = images[0];
    const newImgs = [];
    for (let i = 0; i < num; i++) newImgs.push({ id: crypto.randomUUID(), url: base.url });
    setPhotoWidth(3.5);
    setPhotoHeight(4.5);
    setImages(newImgs);
    setIneMode(false);
  };

  // preset INE
  const presetINE = () => {
    if (images.length < 2) {
      alert("Sube primero el frente y reverso de la INE");
      return;
    }
    const front = images[0];
    const back = images[1];
    setPhotoWidth(9.6);
    setPhotoHeight(6.4);
    setImages([
      { id: crypto.randomUUID(), url: front.url },
      { id: crypto.randomUUID(), url: back.url }
    ]);
    setIneMode(true);
  };

  return (
    <div className="app">
      <h1>EDITA TU DOCUMENTO</h1>

      <div className="panel">
        <label className="data">Ancho (cm)</label>
        <input className="inpData" type="number" value={photoWidth} onChange={e => setPhotoWidth(Number(e.target.value))} />

        <label className="data">Alto (cm)</label>
        <input className="inpData" type="number" value={photoHeight} onChange={e => setPhotoHeight(Number(e.target.value))} />

        <label className="data">Copias</label>
        <input className="inpData" type="number" value={copies} onChange={e => setCopies(Number(e.target.value))} />

        <input className="inpDataF" type="file" multiple onChange={handleUpload} />

        <button className="btnBlue" onClick={() => presetInfantil(6)}>6 Fotos Infantil</button>
        <button className="btnBlue" onClick={() => presetInfantil(12)}>12 Fotos Infantil</button>
        <button className="btnBlack" onClick={presetINE}>INE Frente / Reverso</button>
        <button className="btnGreen" onClick={exportPDF}>Exportar PDF</button>
        <button className="btnRed" onClick={cleanAll}>Limpiar Todo</button>

        <div className="switchContainer">
          <span className="datas">Modo Guillotina</span>
          <label className="switch">
            <input type="checkbox" checked={guillotine} onChange={() => setGuillotine(!guillotine)} />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      <div className="previewArea" ref={previewRef}>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedIds} strategy={rectSortingStrategy}>
            {sheetsArr.map((sheet, index) => (
              <div key={index} className={`sheet ${ineMode ? "sheetINE" : ""}`}>
                {sheet.map(img => (
                  <Photo
                    key={img.id}
                    img={img}
                    width={safePhotoWidth}
                    height={safePhotoHeight}
                    guillotine={guillotine}
                    onDelete={deleteImage}
                  />
                ))}
              </div>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}