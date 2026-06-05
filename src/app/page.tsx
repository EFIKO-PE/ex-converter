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
    addLog('Aplicación lista para digitalización.', 'info');
    return () => {
      stopCamera();
    };
  }, []);

  // Activar cámara
  const startCamera = async () => {
    try {
      addLog('Iniciando cámara...', 'info');
      stopCamera();

      // Configuración de cámara móvil
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
    addLog('Capturando documento...', 'info');

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    // Obtener dimensiones reales del video
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
      addLog('Error al procesar imagen en canvas.', 'error');
      setIsCompressing(false);
      return;
    }
    
    ctx.drawImage(video, 0, 0, width, height);
    
    addLog('Comprimiendo y optimizando legibilidad...', 'info');
    
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
    
    addLog(`Captura optimizada: ${sizeInKB.toFixed(1)} KB (ancho: ${width}px).`, 'success');

    // Apagar cámara tras captura
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
      addLog('Falta ingresar Número de Historia Clínica / DNI.', 'error');
      alert('Por favor, ingresa el Número de Historia Clínica o DNI.');
      return;
    }

    if (!nombrePaciente.trim()) {
      addLog('Falta ingresar el Nombre del Paciente.', 'error');
      alert('Por favor, ingresa el Nombre Completo del Paciente.');
      return;
    }

    if (!rawBase64 || !imageSizeKB) {
      addLog('No hay ninguna captura lista para subir.', 'error');
      return;
    }

    setIsUploading(true);
    addLog('Subiendo datos a la nube...', 'info');

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
        addLog('¡Subida completada con éxito!', 'success');
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
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col font-sans selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      
      {/* Header Estilo Apple (Frosted Glass / Blurriness) */}
      <header className="border-b border-[#E5E5EA] bg-white/70 backdrop-blur-xl sticky top-0 z-50 px-4 py-3.5 sm:px-6">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 bg-[#0071E3] rounded-full shadow-[0_0_8px_#0071E3]" />
            <h1 className="text-base font-semibold tracking-tight text-[#1D1D1F]">
              ExConverter <span className="text-xs text-[#86868B] font-normal">Digitalizador</span>
            </h1>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#86868B] font-semibold tracking-wider uppercase">
            iOS Style
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 flex flex-col gap-4 pb-12">
        
        {/* Patient Form Card */}
        <section className="bg-white border border-[#E5E5EA] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#0071E3]/8 rounded-xl text-[#0071E3]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F]">Datos del Paciente</h2>
              <p className="text-xs text-[#86868B] mt-0.5">Asocia el documento físico antes de iniciar la captura.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3.5">
            <div>
              <label htmlFor="numeroHC" className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">
                Número de Historia Clínica / DNI
              </label>
              <input
                id="numeroHC"
                type="text"
                required
                disabled={isUploading}
                placeholder="Ej. HC-29402 o DNI-482010"
                value={numeroHC}
                onChange={(e) => setNumeroHC(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] placeholder-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="nombrePaciente" className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">
                Nombre Completo del Paciente
              </label>
              <input
                id="nombrePaciente"
                type="text"
                required
                disabled={isUploading}
                placeholder="Ej. María Alejandra Silva"
                value={nombrePaciente}
                onChange={(e) => setNombrePaciente(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] placeholder-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white focus:border-transparent transition-all"
              />
            </div>
          </div>
        </section>

        {/* Camera/Preview Card */}
        <section className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col">
          <div className="p-4.5 border-b border-[#F5F5F7] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-[#34C759] animate-pulse' : 'bg-[#C7C7CC]'}`} />
              {capturedImage ? 'Documento Capturado' : 'Visor de Captura'}
            </span>
            {capturedImage && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#E5E5EA] text-[#1D1D1F] font-semibold">
                {imageSizeKB?.toFixed(1)} KB
              </span>
            )}
          </div>

          {/* Area del Visor */}
          <div className="aspect-[4/3] bg-[#E5E5EA] relative flex items-center justify-center overflow-hidden">
            {/* Vista previa de la foto tomada */}
            {capturedImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img 
                src={capturedImage} 
                alt="Documento capturado" 
                className="w-full h-full object-contain bg-[#1C1C1E] z-10"
              />
            )}

            {/* Video en vivo de la cámara */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover bg-black ${(!isCameraActive || capturedImage) ? 'hidden' : 'block'}`}
            />

            {/* Estado inactivo */}
            {!isCameraActive && !capturedImage && (
              <div className="flex flex-col items-center gap-3.5 text-center p-6 text-[#86868B]">
                <div className="w-14 h-14 rounded-full bg-white border border-[#E5E5EA] flex items-center justify-center text-[#86868B] shadow-sm">
                  <CameraOff className="w-6 h-6" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-[#1D1D1F]">Cámara Apagada</p>
                  <p className="mt-1 text-[#86868B] max-w-[250px]">Enciende la cámara para encuadrar y escanear el documento físico.</p>
                </div>
              </div>
            )}

            {isCompressing && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3.5 z-20">
                <RefreshCw className="w-7 h-7 text-[#0071E3] animate-spin" />
                <span className="text-xs text-[#1D1D1F] font-semibold">Procesando imagen...</span>
              </div>
            )}
          </div>

          {/* Botonera de Cámara */}
          <div className="p-4 bg-white border-t border-[#F5F5F7] flex flex-col gap-2">
            {!capturedImage ? (
              !isCameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-3.5 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0062C2] text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Camera className="w-4.5 h-4.5" />
                  Activar Cámara
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={isCompressing}
                    className="flex-1 py-3.5 bg-[#34C759] hover:bg-[#30B34F] active:bg-[#289E43] text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <ImageIcon className="w-4.5 h-4.5" />
                    Tomar Foto
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4.5 bg-[#E5E5EA] hover:bg-[#D1D1D6] active:bg-[#C7C7CC] text-[#1D1D1F] rounded-xl text-sm flex items-center justify-center transition-all cursor-pointer"
                    title="Apagar Cámara"
                  >
                    <CameraOff className="w-4.5 h-4.5" />
                  </button>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={retakePhoto}
                disabled={isUploading}
                className="w-full py-3 bg-white border border-[#E5E5EA] hover:bg-[#F5F5F7] active:bg-[#E5E5EA] text-[#1D1D1F] font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Volver a Capturar
              </button>
            )}
          </div>
        </section>

        {/* Action: Send to Google Sheets (Apple-Style Slate Black) */}
        {capturedImage && (
          <button
            type="button"
            onClick={uploadToGoogleSheets}
            disabled={isUploading || isCompressing || !numeroHC.trim() || !nombrePaciente.trim()}
            className="w-full py-4 bg-[#1D1D1F] hover:bg-[#2C2C2E] active:bg-[#000000] text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                Subiendo a Google Sheets...
              </>
            ) : (
              <>
                <UploadCloud className="w-4.5 h-4.5" />
                Subir a Google Sheets
              </>
            )}
          </button>
        )}

        {/* Event Log Console (Clean light event feed instead of hacker terminal) */}
        <section className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col">
          <div className="px-4 py-3 bg-[#F5F5F7] border-b border-[#E5E5EA] flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#86868B]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">Registro de Estados</span>
          </div>
          <div className="p-3.5 h-32 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-2 bg-white scrollbar-thin">
            {logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2.5 pb-1.5 border-b border-[#F5F5F7] last:border-0 last:pb-0">
                <span className="text-[#86868B] shrink-0">[{log.time}]</span>
                <span className={`
                  ${log.type === 'success' ? 'text-[#34C759] font-medium' : ''}
                  ${log.type === 'warning' ? 'text-[#FF9500]' : ''}
                  ${log.type === 'error' ? 'text-[#FF3B30] font-semibold animate-pulse' : ''}
                  ${log.type === 'info' ? 'text-[#0071E3]' : ''}
                `}>
                  {log.type === 'success' && '✓ '}
                  {log.type === 'error' && '✕ '}
                  {log.type === 'warning' && '⚠ '}
                  {log.text}
                </span>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-auto py-4 text-center border-t border-[#E5E5EA] bg-white">
        <p className="text-[11px] text-[#86868B]">
          Digitalización Segura • ExConverter Apple Design
        </p>
      </footer>
    </div>
  );
}
