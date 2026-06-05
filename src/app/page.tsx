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
  Image as ImageIcon 
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
    addLog('Listo para capturar.', 'info');
    return () => {
      stopCamera();
    };
  }, []);

  // Activar cámara
  const startCamera = async () => {
    try {
      addLog('Activando visor...', 'info');
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
      addLog(`Cámara no permitida o no disponible.`, 'error');
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
      addLog('Error: Cámara apagada.', 'error');
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
    <div className="min-h-screen flex flex-col justify-center items-center p-3 sm:p-6 select-none">
      
      {/* Teléfono / Contenedor Estilo Neo-minimalista */}
      <div className="w-full max-w-[420px] bg-[#F8F9FB] rounded-[36px] shadow-[0_24px_50px_rgba(0,0,0,0.06)] border border-[#E9EFF2] overflow-hidden flex flex-col">
        
        {/* Header */}
        <header className="px-6 pt-7 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#1A1A1E] flex items-center gap-1.5">
              ExConverter <span className="text-xl">📸</span>
            </h1>
            <p className="text-xs text-[#909AA8] font-semibold mt-0.5">Captura y Digitalización de Historias</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#EBF2F7] flex items-center justify-center border border-[#D9E4EC]">
            <span className="w-2.5 h-2.5 bg-[#34C759] rounded-full animate-pulse" />
          </div>
        </header>

        {/* Formulario y Cámara */}
        <div className="px-6 flex flex-col gap-5 pb-6">
          
          {/* Tarjeta de Datos con inputs muy redondeados y fondo gris suave */}
          <section className="bg-white rounded-[28px] p-5 border border-[#ECEFF3] shadow-[0_4px_16px_rgba(0,0,0,0.015)]">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="numeroHC" className="block text-[10px] font-extrabold uppercase tracking-widest text-[#909AA8] mb-1.5">
                  Historia Clínica o DNI *
                </label>
                <input
                  id="numeroHC"
                  type="text"
                  required
                  disabled={isUploading}
                  placeholder="Ej. HC-29482"
                  value={numeroHC}
                  onChange={(e) => setNumeroHC(e.target.value)}
                  className="w-full bg-[#F0F2F6] border-2 border-transparent rounded-[18px] px-4.5 py-3.5 text-sm text-[#1A1A1E] placeholder-[#A0AAB5] focus:outline-none focus:bg-white focus:border-[#1A1A1E] transition-all hover:bg-[#EAECEF] focus:hover:bg-white"
                />
              </div>

              <div>
                <label htmlFor="nombrePaciente" className="block text-[10px] font-extrabold uppercase tracking-widest text-[#909AA8] mb-1.5">
                  Paciente *
                </label>
                <input
                  id="nombrePaciente"
                  type="text"
                  required
                  disabled={isUploading}
                  placeholder="Ej. Juan Pérez García"
                  value={nombrePaciente}
                  onChange={(e) => setNombrePaciente(e.target.value)}
                  className="w-full bg-[#F0F2F6] border-2 border-transparent rounded-[18px] px-4.5 py-3.5 text-sm text-[#1A1A1E] placeholder-[#A0AAB5] focus:outline-none focus:bg-white focus:border-[#1A1A1E] transition-all hover:bg-[#EAECEF] focus:hover:bg-white"
                />
              </div>
            </div>
          </section>

          {/* Visor de Cámara de Alto Contraste (Caja Negra con Bordes redondeados gruesos) */}
          <section className="bg-[#1A1A1E] rounded-[32px] p-2 shadow-md flex flex-col relative overflow-hidden">
            
            {/* Viewport de Cámara */}
            <div className="aspect-[4/3] rounded-[24px] bg-[#2C2C30] relative flex items-center justify-center overflow-hidden">
              
              {/* Foto tomada */}
              {capturedImage && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={capturedImage} 
                  alt="Documento capturado" 
                  className="w-full h-full object-contain bg-[#121214] z-10 rounded-[24px]"
                />
              )}

              {/* Transmisión de video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover bg-black rounded-[24px] ${(!isCameraActive || capturedImage) ? 'hidden' : 'block'}`}
              />

              {/* Estado inactivo */}
              {!isCameraActive && !capturedImage && (
                <div className="flex flex-col items-center gap-3 text-center p-6 text-[#909AA8]">
                  <div className="w-13 h-13 rounded-full bg-[#2C2C30] flex items-center justify-center text-white/50 shadow-sm border border-white/5">
                    <CameraOff className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-white/80">Cámara Inactiva</p>
                    <p className="mt-0.5 text-xs text-white/40 max-w-[200px]">Presiona Activar Cámara para escanear el documento.</p>
                  </div>
                </div>
              )}

              {/* Cargando/Comprimiendo */}
              {isCompressing && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20 rounded-[24px]">
                  <RefreshCw className="w-7 h-7 text-[#1A1A1E] animate-spin" />
                  <span className="text-xs text-[#1A1A1E] font-bold">Procesando imagen...</span>
                </div>
              )}

              {/* Badge del peso de la captura */}
              {capturedImage && (
                <span className="absolute top-3 right-3 text-[10px] px-2.5 py-1 rounded-full bg-[#1A1A1E]/80 text-[#A7F3D0] font-bold z-20 backdrop-blur-sm">
                  {imageSizeKB?.toFixed(1)} KB
                </span>
              )}
            </div>

            {/* Controles del visor */}
            <div className="p-2 pt-3 flex flex-col gap-2 bg-[#1A1A1E]">
              {!capturedImage ? (
                !isCameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-3.5 bg-white text-[#1A1A1E] hover:bg-slate-100 font-extrabold rounded-[20px] text-xs flex items-center justify-center gap-2 hover-scale cursor-pointer"
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
                      className="flex-1 py-3.5 bg-[#A7F3D0] text-[#047857] hover:bg-[#6EE7B7] font-extrabold rounded-[20px] text-xs flex items-center justify-center gap-2 hover-scale cursor-pointer disabled:opacity-50"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Tomar Foto
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4.5 bg-[#2C2C30] hover:bg-[#3C3C40] text-white/70 hover:text-white rounded-[20px] text-xs flex items-center justify-center cursor-pointer"
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
                  className="w-full py-3 bg-[#2C2C30] hover:bg-[#3C3C40] text-white font-bold rounded-[20px] text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Volver a Capturar
                </button>
              )}
            </div>
          </section>

          {/* Botón Guardar en Sheets (Estilo Botón Redondo Negro Grande) */}
          {capturedImage && (
            <button
              type="button"
              onClick={uploadToGoogleSheets}
              disabled={isUploading || isCompressing || !numeroHC.trim() || !nombrePaciente.trim()}
              className="w-full py-4.5 bg-[#1A1A1E] hover:bg-[#2D2D35] active:bg-[#000000] text-white font-extrabold rounded-full text-xs flex items-center justify-center gap-2 shadow-md hover-scale cursor-pointer disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Guardar en Google Sheets
                </>
              )}
            </button>
          )}

          {/* Registro de Estados tipo burbujas de notificaciones */}
          <section className="bg-[#EBF2F7] rounded-[28px] p-4.5 border border-[#D9E4EC]">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-4 h-4 text-[#909AA8]" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#909AA8]">Bitácora de Estados</span>
            </div>
            
            <div className="h-28 overflow-y-auto font-mono text-[10px] flex flex-col gap-2 scrollbar-thin">
              {logs.length === 0 ? (
                <div className="text-[#909AA8] text-center py-4">Sin actividades recientes</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-2 flex items-start gap-2 shadow-[0_2px_6px_rgba(0,0,0,0.01)] border border-[#ECEFF3]">
                    <span className="text-[#909AA8] text-[9px] mt-0.5">[{log.time}]</span>
                    <span className={`flex-1 leading-snug
                      ${log.type === 'success' ? 'text-[#047857] font-bold' : ''}
                      ${log.type === 'warning' ? 'text-[#D97706]' : ''}
                      ${log.type === 'error' ? 'text-[#E11D48] font-bold animate-pulse' : ''}
                      ${log.type === 'info' ? 'text-[#0369A1] font-semibold' : ''}
                    `}>
                      {log.type === 'success' && '✓ '}
                      {log.type === 'error' && '✗ '}
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
        <footer className="mt-auto py-4 bg-white border-t border-[#ECEFF3] text-center">
          <p className="text-[10px] text-[#909AA8] font-bold uppercase tracking-wider">
            ExConverter • Friendly Tech
          </p>
        </footer>

      </div>
    </div>
  );
}
