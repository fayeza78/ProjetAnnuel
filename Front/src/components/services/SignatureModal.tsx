import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  pdfUrl: string;
  onClose: () => void;
  onSign: (dataUrl: string) => void;
};

// modal de signature : gère son canvas et renvoie le tracé en PNG
function SignatureModal({ pdfUrl, onClose, onSign }: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  // fond blanc au départ
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const pos = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const down = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stop = () => {
    isDrawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    onSign(canvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full">
        <h3 className="text-2xl font-bold mb-4">{t('contrats.signModalTitle')}</h3>

        {pdfUrl ? (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full text-center bg-blue-1 text-white py-3 rounded-full font-bold hover:opacity-90 mb-4"
          >
            {t('contrats.previewBeforeSign')}
          </a>
        ) : (
          <p className="text-sm text-gray-500 mb-4">{t('contrats.noPdf')}</p>
        )}

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">{t('contrats.drawSignatureHint')}</p>
          <canvas
            ref={canvasRef}
            width={400}
            height={150}
            className="w-full border rounded-xl cursor-crosshair touch-none bg-white"
            onMouseDown={down}
            onMouseMove={move}
            onMouseUp={stop}
            onMouseLeave={stop}
          />
          <button
            type="button"
            onClick={clear}
            className="text-sm text-gray-500 underline mt-2"
          >
            {t('contrats.clearSignature')}
          </button>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 text-black py-3 rounded-full font-bold hover:opacity-90"
          >
            {t('services.cancelButton')}
          </button>
          <button
            onClick={confirm}
            disabled={!hasSignature}
            className="flex-1 bg-green-600 text-white py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
          >
            {t('contrats.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SignatureModal;
