'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  CameraOff, 
  UploadCloud, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  FileText, 
  Terminal, 
  Image as ImageIcon,
  Activity
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

  // Helper para agregar logs a la consola visual
  const addLog = (text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [{ time, text, type }, ...prev]);
  };

  // Inicializar consola
  useEffect(() => {
    addLog('Listo para digitalización.', 'info');
    return () => {
      stopCamera();
    };
  }, []);

  // Activar cámara
  const startCamera = async () => {
    try {
      addLog('Iniciando cámara...', 'info');
      stopCamera();

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      setIsCameraActive(true);

      // Asignar stream y reproducir
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.error('Error al reproducir video:', playError);
        }
      }
      
      addLog('Visor en vivo activado.', 'success');
    } catch (error: any) {
      console.error('Error al acceder a la cámara:', error);
      addLog(`Cámara no disponible o permiso denegado.`, 'error');
    }
  };

  // Desactivar cámara
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Capturar foto y procesar (Redimensionar + Comprimir)
  const capturePhoto = () => {
    if (!videoRef.current || !isCameraActive) {
      addLog('Error: Cámara inactiva.', 'error');
      return;
    }

    setIsCompressing(true);
    addLog('Capturando imagen...', 'info');

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    let width = video.videoWidth;
    let height = video.videoHeight;
    
    // Redimensionamiento a 1200px max
    const maxWidth = 1200;
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      addLog('Error al procesar en canvas.', 'error');
      setIsCompressing(false);
      return;
    }
    
    ctx.drawImage(video, 0, 0, width, height);
    
    addLog('Comprimiendo y optimizando archivo...', 'info');
    
    // Comprimir en JPEG a 65% calidad
    const quality = 0.65;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    
    // Calcular peso
    const base64Content = dataUrl.split(',')[1];
    const binaryString = window.atob(base64Content);
    const sizeInBytes = binaryString.length;
    const sizeInKB = sizeInBytes / 1024;
    
    setCapturedImage(dataUrl);
    setRawBase64(base64Content);
    setImageSizeKB(sizeInKB);
    setIsCompressing(false);
    
    addLog(`Captura optimizada a ${sizeInKB.toFixed(1)} KB.`, 'success');

    stopCamera();
  };

  // Resetear captura
  const retakePhoto = () => {
    setCapturedImage(null);
    setRawBase64(null);
    setImageSizeKB(null);
    addLog('Visor reiniciado.', 'info');
    startCamera();
  };

  // Subir datos
  const uploadToGoogleSheets = async () => {
    if (!numeroHC.trim()) {
      addLog('Falta ingresar la Historia Clínica / DNI.', 'error');
      alert('Por favor, ingresa el Número de Historia Clínica o DNI.');
      return;
    }

    if (!nombrePaciente.trim()) {
      addLog('Falta ingresar el Nombre del Paciente.', 'error');
      alert('Por favor, ingresa el Nombre Completo del Paciente.');
      return;
    }

    if (!rawBase64 || !imageSizeKB) {
      addLog('No hay captura disponible para subir.', 'error');
      return;
    }

    setIsUploading(true);
    addLog('Subiendo fila a Google Sheets...', 'info');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numeroHC: numeroHC.trim(),
          nombrePaciente: nombrePaciente.trim(),
          imageBase64: rawBase64,
          sizeKB: imageSizeKB,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();

      if (response.ok) {
        addLog('¡Subida exitosa y vinculada!', 'success');
        addLog(`ID Registro: ${data.idGenerado}`, 'success');
        alert(`¡Subida exitosa!\nID: ${data.idGenerado}\nPaciente: ${nombrePaciente}`);
        
        // Limpiar
        setCapturedImage(null);
        setRawBase64(null);
        setImageSizeKB(null);
        setNumeroHC('');
        setNombrePaciente('');
      } else {
        addLog(`Error al subir: ${data.error || 'Respuesta fallida'}`, 'error');
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      addLog('Error de conexión. Revisa tu acceso a internet.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-3 sm:p-6 select-none bg-[#F3F4F6]">
      
      {/* Contenedor Principal con Sombras Difusas y Bordes Redondeados */}
      <div className="w-full max-w-[420px] bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-[#E5E7EB] overflow-hidden flex flex-col">
        
        {/* Header con Íconos de Línea Limpios (Estilo Apple/Soft UI, sin Emojis) */}
        <header className="px-6 pt-7 pb-4 flex items-center justify-between border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/8 flex items-center justify-center text-[#0071E3]">
              <Camera className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#1F2937]">
                ExConverter
              </h1>
              <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider">Escaner Clínico</p>
            </div>
          </div>
          <span className="text-[10px] px-3 py-1 rounded-full bg-[#F3F4F6] text-[#6B7280] font-bold tracking-wider uppercase">
            v1.1
          </span>
        </header>

        {/* Formulario y Cámara */}
        <div className="px-6 flex flex-col gap-5 py-5">
          
          {/* Tarjeta de Datos con Marcos Visibles y Bordes Claros */}
          <section className="bg-white rounded-[24px] p-5 border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="numeroHC" className="block text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280] mb-1.5">
                  Número de Historia Clínica / DNI *
                </label>
                <input
                  id="numeroHC"
                  type="text"
                  required
                  disabled={isUploading}
                  placeholder="Ej. HC-29482"
                  value={numeroHC}
                  onChange={(e) => setNumeroHC(e.target.value)}
                  className="w-full bg-[#F9FAFB] border-2 border-[#E5E7EB] rounded-xl px-4 py-3 text-sm text-[#1F2937] placeholder-[#D1D5DB] focus:outline-none focus:bg-white focus:border-[#0071E3] focus:ring-0 transition-all"
                />
              </div>

              <div>
                <label htmlFor="nombrePaciente" className="block text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280] mb-1.5">
                  Nombre Completo del Paciente *
                </label>
                <input
                  id="nombrePaciente"
                  type="text"
                  required
                  disabled={isUploading}
                  placeholder="Ej. Juan Pérez García"
                  value={nombrePaciente}
                  onChange={(e) => setNombrePaciente(e.target.value)}
                  className="w-full bg-[#F9FAFB] border-2 border-[#E5E7EB] rounded-xl px-4 py-3 text-sm text-[#1F2937] placeholder-[#D1D5DB] focus:outline-none focus:bg-white focus:border-[#0071E3] focus:ring-0 transition-all"
                />
              </div>
            </div>
          </section>

          {/* Visor de Cámara Estilo Soft-Card (Bordes redondeados, Marco claro y Fondo gris suave) */}
          <section className="bg-white rounded-[28px] p-3.5 border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col relative overflow-hidden">
            
            {/* Viewport de Cámara */}
            <div className="aspect-[4/3] rounded-[20px] bg-[#F3F4F6] border border-[#E5E7EB] relative flex items-center justify-center overflow-hidden">
              
              {/* Foto tomada */}
              {capturedImage && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={capturedImage} 
                  alt="Documento capturado" 
                  className="w-full h-full object-contain bg-[#1F2937] z-10 rounded-[20px]"
                />
              )}

              {/* Transmisión de video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover bg-black rounded-[20px] ${(!isCameraActive || capturedImage) ? 'hidden' : 'block'}`}
              />

              {/* Estado inactivo */}
              {!isCameraActive && !capturedImage && (
                <div className="flex flex-col items-center gap-3.5 text-center p-6 text-[#9CA3AF]">
                  <div className="w-12 h-12 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#9CA3AF] shadow-sm">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-[#1F2937]">Cámara Apagada</p>
                    <p className="mt-0.5 text-xs text-[#9CA3AF] max-w-[200px]">Enciende la cámara para encuadrar y escanear el documento.</p>
                  </div>
                </div>
              )}

              {/* Cargando/Comprimiendo */}
              {isCompressing && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3.5 z-20 rounded-[20px]">
                  <RefreshCw className="w-6 h-6 text-[#0071E3] animate-spin" />
                  <span className="text-xs text-[#1F2937] font-bold">Procesando y optimizando...</span>
                </div>
              )}

              {/* Badge del peso de la captura */}
              {capturedImage && (
                <span className="absolute top-3 right-3 text-[10px] px-2.5 py-1 rounded-full bg-white/90 text-[#0071E3] border border-[#E5E7EB] font-bold z-20 backdrop-blur-sm shadow-sm">
                  {imageSizeKB?.toFixed(1)} KB
                </span>
              )}
            </div>

            {/* Controles del visor */}
            <div className="pt-3.5 flex flex-col gap-2 bg-white">
              {!capturedImage ? (
                !isCameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-3.5 bg-[#0071E3] text-white hover:bg-[#0077ED] active:bg-[#0062C2] font-extrabold rounded-full text-xs flex items-center justify-center gap-2 hover-scale cursor-pointer shadow-sm shadow-[#0071E3]/15"
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
                      className="flex-1 py-3.5 bg-[#34C759] text-white hover:bg-[#30B34F] active:bg-[#289E43] font-extrabold rounded-full text-xs flex items-center justify-center gap-2 hover-scale cursor-pointer disabled:opacity-50"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Tomar Foto
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#4B5563] rounded-full text-xs flex items-center justify-center cursor-pointer border border-[#E5E7EB]"
                      title="Apagar Cámara"
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
                  className="w-full py-3 bg-white hover:bg-[#F9FAFB] active:bg-[#F3F4F6] text-[#4B5563] border-2 border-[#E5E7EB] font-bold rounded-full text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Volver a Capturar
                </button>
              )}
            </div>
          </section>

          {/* Botón Guardar en Sheets (Estilo Botón Pill Negro Grande) */}
          {capturedImage && (
            <button
              type="button"
              onClick={uploadToGoogleSheets}
              disabled={isUploading || isCompressing || !numeroHC.trim() || !nombrePaciente.trim()}
              className="w-full py-4.5 bg-[#1F2937] hover:bg-[#374151] active:bg-[#111827] text-white font-extrabold rounded-full text-xs flex items-center justify-center gap-2 shadow-md hover-scale cursor-pointer disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4.5 h-4.5" />
                  Guardar en Google Sheets
                </>
              )}
            </button>
          )}

          {/* Bitácora de Estados en una tarjeta blanca con bordes claros y entradas ordenadas */}
          <section className="bg-white rounded-[24px] p-5 border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4.5 h-4.5 text-[#9CA3AF]" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF]">Registro de Estado</span>
            </div>
            
            <div className="h-28 overflow-y-auto font-mono text-[10px] flex flex-col gap-2 scrollbar-thin">
              {logs.length === 0 ? (
                <div className="text-[#9CA3AF] text-center py-4">Sin actividades recientes</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="bg-[#F9FAFB] rounded-xl p-2.5 flex items-start gap-2 border border-[#E5E7EB]">
                    <span className="text-[#9CA3AF] text-[9px] mt-0.5 shrink-0">[{log.time}]</span>
                    <span className={`flex-1 leading-snug
                      ${log.type === 'success' ? 'text-[#34C759] font-bold' : ''}
                      ${log.type === 'warning' ? 'text-[#D97706]' : ''}
                      ${log.type === 'error' ? 'text-[#EF4444] font-bold animate-pulse' : ''}
                      ${log.type === 'info' ? 'text-[#0071E3] font-semibold' : ''}
                    `}>
                      {log.type === 'success' && '✓ '}
                      {log.type === 'error' && '✕ '}
                      {log.type === 'warning' && '⚠ '}
                      {log.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>

        {/* Footer */}
        <footer className="mt-auto py-4 bg-[#F9FAFB] border-t border-[#F3F4F6] text-center">
          <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider">
            ExConverter • Friendly Escaner
          </p>
        </footer>

      </div>
    </div>
  );
}
