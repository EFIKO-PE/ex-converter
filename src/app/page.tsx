'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  CameraOff,
  UploadCloud,
  RefreshCw,
  Image as ImageIcon,
  Activity,
  User,
  FileDigit,
  CheckCircle2,
  XCircle,
  Info,
  ChevronRight
} from 'lucide-react';

interface LogEntry {
  time: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}


export default function Home() {
  const [numeroHC, setNumeroHC] = useState('');
  const [nombrePaciente, setNombrePaciente] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [rawBase64, setRawBase64] = useState<string | null>(null);
  const [imageSizeKB, setImageSizeKB] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentStep = !capturedImage ? (numeroHC && nombrePaciente ? 1 : 0) : 2;

  const addLog = (text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [{ time, text, type }, ...prev]);
  };

  useEffect(() => {
    addLog('Sistema listo para digitalizar.', 'info');
    return () => { stopCamera(); };
  }, []);

  const startCamera = async () => {
    try {
      addLog('Solicitando acceso a la cámara...', 'info');
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(console.error);
      }
      addLog('Visor activo. Encuadra el documento.', 'success');
    } catch {
      addLog('Permiso de cámara denegado o no disponible.', 'error');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !isCameraActive) { addLog('Error: cámara no activa.', 'error'); return; }
    setIsCompressing(true);
    addLog('Capturando fotograma...', 'info');
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    let w = video.videoWidth, h = video.videoHeight;
    if (w > 1200) { h = Math.round((h * 1200) / w); w = 1200; }
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { addLog('Error de canvas.', 'error'); setIsCompressing(false); return; }
    ctx.drawImage(video, 0, 0, w, h);
    addLog('Comprimiendo a JPEG 65%...', 'info');
    const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    const b64 = dataUrl.split(',')[1];
    const kb = window.atob(b64).length / 1024;
    setCapturedImage(dataUrl);
    setRawBase64(b64);
    setImageSizeKB(kb);
    setIsCompressing(false);
    addLog(`Captura lista · ${kb.toFixed(1)} KB · ${w}px ancho.`, 'success');
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedImage(null); setRawBase64(null); setImageSizeKB(null);
    addLog('Nueva toma iniciada.', 'info');
    startCamera();
  };

  const uploadToGoogleSheets = async () => {
    if (!numeroHC.trim()) { addLog('Falta Número de Historia Clínica.', 'error'); return; }
    if (!nombrePaciente.trim()) { addLog('Falta Nombre del Paciente.', 'error'); return; }
    if (!rawBase64) { addLog('No hay imagen para subir.', 'error'); return; }
    setIsUploading(true);
    addLog('Enviando datos a Google Sheets...', 'info');
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroHC: numeroHC.trim(), nombrePaciente: nombrePaciente.trim(), imageBase64: rawBase64, sizeKB: imageSizeKB, timestamp: new Date().toISOString() })
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`¡Guardado exitosamente! ID: ${data.idGenerado}`, 'success');
        alert(`✅ Subida exitosa\nID: ${data.idGenerado}\nPaciente: ${nombrePaciente}`);
        setCapturedImage(null); setRawBase64(null); setImageSizeKB(null); setNumeroHC(''); setNombrePaciente('');
      } else {
        addLog(`Error al guardar: ${data.error || 'Error desconocido'}`, 'error');
      }
    } catch {
      addLog('Error de conexión. Revisa tu internet.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E8EBF0] via-[#EEF0F5] to-[#E4E8EF] flex items-start justify-center p-4 pt-8 pb-12">
      <div className="w-full max-w-[400px] flex flex-col gap-4">

        {/* ── Brand Header ─────────────────────────────── */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h1 className="text-[22px] font-black tracking-tight text-[#0F1117] leading-none">
              ExConverter
            </h1>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white shadow-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${isCameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isCameraActive ? 'Live' : 'Stand by'}
            </span>
          </div>
        </div>

        {/* ── Step Indicator ─────────────────────────────── */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] px-5 py-3.5 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i < currentStep
                    ? 'bg-[#6366F1] shadow-[0_1px_4px_rgba(99,102,241,0.2)]'
                    : i === currentStep
                    ? 'bg-[#0F1117] shadow-[0_1px_4px_rgba(15,17,23,0.15)] animate-pulse'
                    : 'bg-slate-200/80'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6366F1]">
              Paso {currentStep + 1} de 3
            </span>
            <span className="text-[11px] font-bold text-[#0F1117] transition-all duration-300">
              {currentStep === 0 && 'Identificación del Paciente'}
              {currentStep === 1 && 'Captura del Documento'}
              {currentStep === 2 && 'Subida a Google Sheets'}
            </span>
          </div>
        </div>

        {/* ── Patient Data Card ─────────────────────────── */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 pt-5 pb-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Identificación del Paciente</p>
          </div>
          <div className="px-5 pb-5 pt-4 flex flex-col gap-4">

            {/* HC Input */}
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#6366F1] transition-colors duration-200">
                <FileDigit className="w-4 h-4" />
              </div>
              <input
                id="numeroHC"
                type="text"
                required
                disabled={isUploading}
                placeholder="Número de Historia Clínica / DNI"
                value={numeroHC}
                onChange={(e) => setNumeroHC(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 text-sm font-medium text-[#0F1117] placeholder-slate-300 bg-[#F8F9FC] rounded-xl border-2 border-[#E2E6EF] focus:border-[#6366F1] focus:bg-white focus:outline-none transition-all duration-200 disabled:opacity-50"
              />
              {numeroHC && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </div>

            {/* Nombre Input */}
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#6366F1] transition-colors duration-200">
                <User className="w-4 h-4" />
              </div>
              <input
                id="nombrePaciente"
                type="text"
                required
                disabled={isUploading}
                placeholder="Nombre completo del paciente"
                value={nombrePaciente}
                onChange={(e) => setNombrePaciente(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 text-sm font-medium text-[#0F1117] placeholder-slate-300 bg-[#F8F9FC] rounded-xl border-2 border-[#E2E6EF] focus:border-[#6366F1] focus:bg-white focus:outline-none transition-all duration-200 disabled:opacity-50"
              />
              {nombrePaciente && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </div>

          </div>
        </div>

        {/* ── Camera Viewfinder Card ─────────────────────── */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">

          {/* Camera label */}
          <div className="px-5 pt-4 pb-0 flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Visor de Captura</p>
            {capturedImage && imageSizeKB && (
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#6366F1] border border-[#E0E7FF]">
                {imageSizeKB.toFixed(1)} KB
              </span>
            )}
          </div>

          {/* Viewport */}
          <div className="mx-4 mt-3 rounded-[16px] overflow-hidden bg-[#0F1117] aspect-[4/3] relative flex items-center justify-center">

            {capturedImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={capturedImage} alt="Captura" className="w-full h-full object-contain z-10" />
            )}

            <video
              ref={videoRef}
              autoPlay playsInline muted
              className={`w-full h-full object-cover ${(!isCameraActive || capturedImage) ? 'hidden' : 'block'}`}
            />

            {!isCameraActive && !capturedImage && (
              <div className="flex flex-col items-center gap-3 text-center px-6">
                {/* Scanner frame icon instead of camera icon */}
                <div className="relative w-16 h-16">
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white/30 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white/30 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white/30 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white/30 rounded-br-lg" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-8 bg-white/10 rounded-full" />
                    <div className="w-8 h-1 bg-white/10 rounded-full absolute" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-white/70">Cámara inactiva</p>
                  <p className="text-[11px] text-white/30 mt-0.5 max-w-[180px]">Activa el visor para encuadrar y capturar el documento físico.</p>
                </div>
              </div>
            )}

            {isCompressing && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
                <RefreshCw className="w-6 h-6 text-[#6366F1] animate-spin" />
                <span className="text-xs text-[#0F1117] font-bold">Optimizando imagen...</span>
              </div>
            )}
          </div>

          {/* Camera controls */}
          <div className="px-4 pb-4 pt-3.5 flex flex-col gap-2.5">
            {!capturedImage ? (
              !isCameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-3.5 bg-[#6366F1] hover:bg-[#5558E3] active:scale-[0.98] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(99,102,241,0.30)] cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Activar Cámara
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={isCompressing}
                    className="flex-1 py-3.5 bg-[#0F1117] hover:bg-[#1F2430] active:scale-[0.98] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(0,0,0,0.18)] cursor-pointer disabled:opacity-40"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Tomar Foto
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-200 text-slate-500 rounded-2xl flex items-center justify-center cursor-pointer"
                    title="Apagar"
                  >
                    <CameraOff className="w-4 h-4" />
                  </button>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={retakePhoto}
                disabled={isUploading}
                className="w-full py-3.5 bg-white hover:bg-slate-50 active:scale-[0.98] border-2 border-[#E2E6EF] text-[#0F1117] font-bold rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Nueva Captura
              </button>
            )}
          </div>
        </div>

        {/* ── Upload CTA ─────────────────────────────────── */}
        {capturedImage && (
          <button
            type="button"
            onClick={uploadToGoogleSheets}
            disabled={isUploading || !numeroHC.trim() || !nombrePaciente.trim()}
            className="w-full py-4 bg-[#0F1117] hover:bg-[#1F2430] active:scale-[0.98] disabled:opacity-30 disabled:scale-100 disabled:cursor-not-allowed text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2.5 shadow-[0_8px_24px_rgba(15,17,23,0.20)] cursor-pointer"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                Subiendo a Google Sheets...
              </>
            ) : (
              <>
                <UploadCloud className="w-4.5 h-4.5" />
                Guardar en Google Sheets
                <ChevronRight className="w-4 h-4 opacity-50" />
              </>
            )}
          </button>
        )}

        {/* ── Activity Log ───────────────────────────────── */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registro de Actividad</span>
          </div>
          <div className="px-4 py-3 h-[130px] overflow-y-auto flex flex-col gap-2 scrollbar-thin">
            {logs.map((log, idx) => {
              const iconMap = {
                success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" />,
                error: <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-px animate-pulse" />,
                warning: <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" />,
                info: <Info className="w-3.5 h-3.5 text-[#6366F1] shrink-0 mt-px" />,
              };
              const textMap = {
                success: 'text-emerald-700',
                error: 'text-rose-600',
                warning: 'text-amber-700',
                info: 'text-slate-600',
              };
              return (
                <div key={idx} className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
                  {iconMap[log.type]}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className={`text-[11px] font-semibold leading-snug ${textMap[log.type]}`}>
                      {log.text}
                    </span>
                    <span className="text-[9px] text-slate-300 font-medium">{log.time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        <p className="text-center text-[10px] text-slate-400 font-medium pb-2">
          ExConverter · Digitalización Segura y Local
        </p>

      </div>
    </div>
  );
}
