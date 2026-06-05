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
    addLog('Sistema inicializado. Listo para capturar.', 'info');
    return () => {
      stopCamera();
    };
  }, []);

  // Activar cámara
  const startCamera = async () => {
    try {
      addLog('Solicitando acceso a la cámara...', 'info');
      // Detener cualquier stream anterior
      stopCamera();

      // Configuración de cámara móvil (720p para máxima compatibilidad)
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

      // Asignar el stream al elemento de video y reproducir
      // El video siempre está en el DOM, por lo que videoRef.current no es nulo.
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.error('Error al iniciar reproducción de video:', playError);
        }
      }
      
      addLog('Cámara activada exitosamente (Cámara trasera preferida).', 'success');
    } catch (error: any) {
      console.error('Error al acceder a la cámara:', error);
      addLog(`Error al activar cámara: Permiso denegado o no disponible.`, 'error');
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
      addLog('Error: La cámara no está activa.', 'error');
      return;
    }

    setIsCompressing(true);
    addLog('Capturando fotograma de video...', 'info');

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    // Obtener dimensiones reales del video
    let width = video.videoWidth;
    let height = video.videoHeight;
    
    // Redimensionamiento logístico a ancho máximo de 1200px
    const maxWidth = 1200;
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      addLog('Error al inicializar el contexto del Canvas.', 'error');
      setIsCompressing(false);
      return;
    }
    
    // Dibujar el fotograma en el canvas
    ctx.drawImage(video, 0, 0, width, height);
    
    addLog('Comprimiendo imagen (JPEG, Calidad 65%)...', 'info');
    
    // Comprimir en JPEG con calidad de 0.65 (65%)
    const quality = 0.65;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    
    // Extraer base64 y calcular el tamaño en KB
    const base64Content = dataUrl.split(',')[1];
    const binaryString = window.atob(base64Content);
    const sizeInBytes = binaryString.length;
    const sizeInKB = sizeInBytes / 1024;
    
    setCapturedImage(dataUrl);
    setRawBase64(base64Content);
    setImageSizeKB(sizeInKB);
    setIsCompressing(false);
    
    addLog(`Foto tomada y comprimida a ${sizeInKB.toFixed(1)} KB (Ancho: ${width}px).`, 'success');
    
    // Si pesa fuera del rango esperado, alertar amigablemente al usuario
    if (sizeInKB < 150) {
      addLog('Nota: Imagen muy ligera (<150KB). Legibilidad garantizada.', 'info');
    } else if (sizeInKB > 250) {
      addLog('Nota: Imagen ligeramente superior a 250KB, texto altamente definido.', 'info');
    }

    // Detener la cámara para ahorrar energía y recursos
    stopCamera();
  };

  // Resetear la captura para tomar otra
  const retakePhoto = () => {
    setCapturedImage(null);
    setRawBase64(null);
    setImageSizeKB(null);
    addLog('Captura reiniciada. Listo para nueva toma.', 'info');
    startCamera();
  };

  // Subir datos a la API de Next.js
  const uploadToGoogleSheets = async () => {
    // Validar Historia Clínica
    if (!numeroHC.trim()) {
      addLog('Error de validación: Debe ingresar el Número de Historia Clínica.', 'error');
      alert('Por favor, ingresa el Número de Historia Clínica o DNI antes de subir.');
      return;
    }

    if (!rawBase64 || !imageSizeKB) {
      addLog('Error de validación: No hay ninguna captura de imagen para subir.', 'error');
      return;
    }

    setIsUploading(true);
    addLog('Iniciando subida a Google Sheets...', 'info');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numeroHC: numeroHC.trim(),
          imageBase64: rawBase64,
          sizeKB: imageSizeKB,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();

      if (response.ok) {
        addLog('Subiendo exitosamente. ¡Fila insertada!', 'success');
        addLog(`ID Generado: ${data.idGenerado}`, 'success');
        alert(`¡Subida exitosa!\nID: ${data.idGenerado}\nDocumento vinculado a la HC: ${numeroHC}`);
        
        // Limpiar formulario y captura tras subir con éxito
        setCapturedImage(null);
        setRawBase64(null);
        setImageSizeKB(null);
        setNumeroHC('');
      } else {
        addLog(`Error de subida: ${data.error || 'Respuesta de servidor inválida'}`, 'error');
        if (data.details) console.error(data.details);
      }
    } catch (error: any) {
      console.error('Error de conexión:', error);
      addLog('Error de conexión con el servidor. Verifica tu internet.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F8FAFC] flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="border-b border-[#1E293B] bg-[#0D0E16]/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 sm:px-6">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              ExConverter <span className="text-xs text-slate-500 font-medium">v1.0</span>
            </h1>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950/60 border border-blue-900/50 text-blue-400 font-semibold uppercase tracking-wider">
            Mobile-First
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 flex flex-col gap-5 pb-10">
        
        {/* Step Info Card */}
        <section className="bg-gradient-to-br from-[#131524] to-[#0E101A] border border-[#1E293B] rounded-2xl p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-950/80 rounded-lg border border-blue-900/40 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Identificación del Documento</h2>
              <p className="text-xs text-slate-400 mt-0.5">Asigna el número de Historia Clínica (HC) o DNI antes de registrar la captura.</p>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="numeroHC" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Número de Historia Clínica / DNI *
            </label>
            <input
              id="numeroHC"
              type="text"
              required
              disabled={isUploading}
              placeholder="Ej. HC-948203 o DNI-48291039"
              value={numeroHC}
              onChange={(e) => setNumeroHC(e.target.value)}
              className="w-full bg-[#0A0B10] border border-[#1E293B] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            />
          </div>
        </section>

        {/* Capture/Preview Window */}
        <section className="bg-[#0D0E16] border border-[#1E293B] rounded-2xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-3 bg-[#131524] border-b border-[#1E293B] flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-green-500 animate-ping' : 'bg-slate-600'}`} />
              {capturedImage ? 'Vista Previa del Documento' : 'Cámara / Visor'}
            </span>
            {capturedImage && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-blue-950 border border-blue-900 text-blue-400 font-mono">
                {imageSizeKB?.toFixed(1)} KB
              </span>
            )}
          </div>

          {/* Area de Visualización de Cámara o Foto */}
          <div className="aspect-[4/3] bg-[#06070B] relative flex items-center justify-center overflow-hidden">
            {/* Vista previa de la foto tomada */}
            {capturedImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img 
                src={capturedImage} 
                alt="Documento capturado" 
                className="w-full h-full object-contain z-10"
              />
            )}

            {/* Video en vivo de la cámara - Siempre montado para evitar condiciones de carrera en React */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${(!isCameraActive || capturedImage) ? 'hidden' : 'block'}`}
            />

            {/* Estado inactivo / Sin iniciar cámara */}
            {!isCameraActive && !capturedImage && (
              <div className="flex flex-col items-center gap-3 text-center p-6 text-slate-500">
                <div className="w-16 h-16 rounded-full bg-slate-950 border border-slate-900 flex items-center justify-center text-slate-600">
                  <CameraOff className="w-8 h-8" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-400">Cámara Inactiva</p>
                  <p className="mt-1 text-slate-500 max-w-[240px]">Haz clic en "Activar Cámara" para iniciar la transmisión y encuadrar el documento.</p>
                </div>
              </div>
            )}

            {isCompressing && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-xs text-slate-300 font-medium">Procesando y comprimiendo imagen...</span>
              </div>
            )}
          </div>

          {/* Botonera de Cámara */}
          <div className="p-4 bg-[#0D0E16] border-t border-[#1E293B] flex flex-col gap-2">
            {!capturedImage ? (
              !isCameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 transition-all cursor-pointer"
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
                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-55"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Tomar Foto
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 active:bg-slate-950 text-slate-300 rounded-xl text-sm flex items-center justify-center transition-all cursor-pointer"
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
                className="w-full py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 active:bg-slate-950 text-slate-300 font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Volver a Tomar Foto
              </button>
            )}
          </div>
        </section>

        {/* Action: Send to Google Sheets */}
        {capturedImage && (
          <button
            type="button"
            onClick={uploadToGoogleSheets}
            disabled={isUploading || isCompressing || !numeroHC.trim()}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Subiendo a Google Sheets...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                Subir a Google Sheets
              </>
            )}
          </button>
        )}

        {/* Terminal Visual Console */}
        <section className="bg-[#05060A] border border-[#1E293B] rounded-2xl overflow-hidden shadow-lg flex flex-col">
          <div className="px-4 py-2 bg-[#0D0E16] border-b border-[#1E293B] flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Consola de Estado</span>
          </div>
          <div className="p-3 h-32 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-slate-800">
            {logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2 border-b border-slate-950 pb-1">
                <span className="text-slate-600 shrink-0">[{log.time}]</span>
                <span className={`
                  ${log.type === 'success' ? 'text-emerald-400 font-semibold' : ''}
                  ${log.type === 'warning' ? 'text-amber-400' : ''}
                  ${log.type === 'error' ? 'text-rose-400 font-semibold animate-pulse' : ''}
                  ${log.type === 'info' ? 'text-sky-300' : ''}
                `}>
                  {log.type === 'success' && '✓ '}
                  {log.type === 'error' && '✗ '}
                  {log.type === 'warning' && '⚠ '}
                  {log.text}
                </span>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-auto py-4 text-center border-t border-[#1E293B] bg-[#07080D]">
        <p className="text-[11px] text-slate-500">
          Diseñado para digitalización rápida y captura local de alta legibilidad.
        </p>
      </footer>
    </div>
  );
}
