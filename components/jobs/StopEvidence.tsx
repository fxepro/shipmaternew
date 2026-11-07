'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, PenLine, Trash2, Download, X, Loader2, Image as ImageIcon, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { freightJobApi } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Evidence {
  id: number;
  evidence_type: string;
  file_url: string;
  mime_type: string;
  taken_at: string | null;
  notes: string | null;
  uploader: { id: number; name: string } | null;
}

interface StopData {
  id: number;
  stop_type: 'pickup' | 'dropoff';
  status: string;
  photos_required: boolean;
  signature_url: string | null;
  signature_name: string | null;
  signature_at: string | null;
  pod_pdf_url: string | null;
}

interface Props {
  job: { id: number; status: string };
  stop: StopData;
  role: 'shipper' | 'carrier';
  /** Whether this person may add photos, a signature or the POD on this stop (defaults to any carrier) */
  canUpload?: boolean;
  apiBase: string;
  onStopChanged?: () => void;
}

// ── Signature pad modal ────────────────────────────────────────────────────────

function SignaturePadModal({
  onSave,
  onClose,
  saving,
}: {
  onSave: (dataUrl: string, name: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const drawingRef  = useRef(false);
  const [name, setName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current; if (!canvas) return;
    drawingRef.current = true;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault();
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
    e.preventDefault();
  }

  function stop() { drawingRef.current = false; }

  function clear() {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function save() {
    const canvas = canvasRef.current; if (!canvas || !hasDrawn || !name.trim()) return;
    onSave(canvas.toDataURL('image/png'), name.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-cream-dark)]">
          <h3 className="text-base font-bold text-[var(--color-text)]">Capture Signature</h3>
          <button onClick={onClose} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text-faint)] mb-1.5">
              Full name (printed) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-xl border border-[var(--color-cream-dark)] px-3.5 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text-faint)]">
                Signature <span className="text-red-500">*</span>
              </label>
              <button
                onClick={clear}
                className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
              >
                Clear
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={440}
              height={140}
              className="w-full border-2 border-dashed border-[var(--color-cream-dark)] rounded-xl cursor-crosshair bg-[#fafafa] touch-none"
              style={{ touchAction: 'none' }}
              onMouseDown={start}
              onMouseMove={draw}
              onMouseUp={stop}
              onMouseLeave={stop}
              onTouchStart={start}
              onTouchMove={draw}
              onTouchEnd={stop}
            />
            {!hasDrawn && (
              <p className="text-center text-xs text-[var(--color-text-faint)] mt-1">Draw signature above</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-[var(--color-cream-dark)] bg-[var(--color-cream)]">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-cream-dark)] bg-white py-2 text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!hasDrawn || !name.trim() || saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-teal)] py-2 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Save Signature
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function StopEvidence({ job, stop: initialStop, role, canUpload: canUploadProp, apiBase, onStopChanged }: Props) {
  const qc        = useQueryClient();
  const fileRef   = useRef<HTMLInputElement>(null);
  const [sigModal, setSigModal] = useState(false);
  const [stop,     setStop]     = useState(initialStop);

  // Keep local stop state in sync when parent re-renders
  useEffect(() => { setStop(initialStop); }, [initialStop]);

  // Fetch evidence for this stop
  const { data, isLoading } = useQuery({
    queryKey: ['evidence', job.id, stop.id],
    queryFn:  async () => {
      const res = await freightJobApi.listEvidence(job.id, stop.id);
      // Sync updated stop fields (pod_pdf_url, signature_url, etc.) from response
      if (res.data?.stop) setStop((prev) => ({ ...prev, ...res.data.stop }));
      return res.data?.data as Evidence[];
    },
    enabled: true,
  });

  const photos = (data ?? []).filter(e => (e.mime_type ?? '').startsWith('image/') && e.evidence_type !== 'signature');

  // Upload photo
  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('evidence_type', stop.stop_type === 'pickup' ? 'pickup' : 'dropoff');
      fd.append('taken_at', new Date().toISOString());
      return freightJobApi.uploadEvidence(job.id, stop.id, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evidence', job.id, stop.id] });
      toast.success('Photo uploaded.');
    },
    onError: () => toast.error('Upload failed.'),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = '';
  }

  // Delete photo
  const deleteMutation = useMutation({
    mutationFn: (evidenceId: number) => freightJobApi.deleteEvidence(job.id, evidenceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evidence', job.id, stop.id] });
      toast.success('Photo removed.');
    },
    onError: () => toast.error('Delete failed.'),
  });

  // Save signature
  const sigMutation = useMutation({
    mutationFn: ({ dataUrl, name }: { dataUrl: string; name: string }) =>
      freightJobApi.saveSignature(job.id, stop.id, { signature_data: dataUrl, signature_name: name }),
    onSuccess: (res) => {
      setSigModal(false);
      setStop(prev => ({
        ...prev,
        signature_url:  res.data.signature_url,
        signature_name: res.data.signature_name,
        signature_at:   res.data.signature_at,
      }));
      qc.invalidateQueries({ queryKey: ['evidence', job.id, stop.id] });
      toast.success('Signature saved.');
      onStopChanged?.();
    },
    onError: () => toast.error('Failed to save signature.'),
  });

  // Generate POD
  const podMutation = useMutation({
    mutationFn: () => freightJobApi.generatePod(job.id, stop.id),
    onSuccess: (res) => {
      const url = res.data?.url;
      if (url) {
        setStop(prev => ({ ...prev, pod_pdf_url: url }));
        window.open(url, '_blank');
      }
      toast.success('POD generated.');
    },
    onError: () => toast.error('Failed to generate POD.'),
  });

  // Only show evidence controls for active/completed jobs
  const jobActive = ['posted', 'in_progress', 'completed'].includes(job.status);
  if (!jobActive) return null;

  // Carrier can upload/sign, shipper can view
  const canUpload = canUploadProp ?? role === 'carrier';
  const stopDone  = stop.status === 'completed';

  const podUrl = stop.pod_pdf_url
    ? stop.pod_pdf_url
    : `${apiBase}/api/v1/jobs/${job.id}/stops/${stop.id}/pod`;

  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-cream-dark)]">

      {/* Photos section */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">
          <ImageIcon size={9} className="inline mr-1" />
          Photos {photos.length > 0 && `(${photos.length})`}
        </p>

        {canUpload && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="flex items-center gap-1 rounded-lg border border-[var(--color-cream-dark)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors disabled:opacity-50"
            >
              {uploadMutation.isPending
                ? <Loader2 size={10} className="animate-spin" />
                : <Camera size={10} />
              }
              Add Photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
              className="hidden"
              onChange={handleFileChange}
              capture="environment"
            />
          </>
        )}
      </div>

      {/* Photo grid */}
      {isLoading ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[0,1,2].map(n => (
            <div key={n} className="h-16 w-16 shrink-0 rounded-lg bg-[var(--color-cream)] animate-pulse" />
          ))}
        </div>
      ) : photos.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {photos.map(p => (
            <div key={p.id} className="relative h-16 w-16 shrink-0 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.file_url}
                alt="Evidence"
                className="h-16 w-16 object-cover rounded-lg border border-[var(--color-cream-dark)]"
              />
              {canUpload && (
                <button
                  onClick={() => deleteMutation.mutate(p.id)}
                  disabled={deleteMutation.isPending}
                  className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-full bg-red-600 text-white shadow-sm hover:bg-red-700 transition-colors"
                >
                  <Trash2 size={9} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-faint)] mb-2">No photos yet.</p>
      )}

      {/* Signature + POD section — only when stop is completed */}
      {stopDone && (
        <div className="mt-2 flex flex-wrap items-center gap-2">

          {/* Signature status */}
          {stop.signature_url ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1">
              <CheckCircle2 size={11} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">
                Signed · {stop.signature_name}
              </span>
            </div>
          ) : canUpload ? (
            <button
              onClick={() => setSigModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors"
            >
              <PenLine size={11} /> Capture Signature
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1">
              <span className="text-xs text-amber-700">Awaiting signature</span>
            </div>
          )}

          {/* POD PDF */}
          {stop.pod_pdf_url ? (
            <a
              href={podUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-teal)] hover:border-[var(--color-teal)] transition-colors"
            >
              <FileText size={11} />
              View {stop.stop_type === 'pickup' ? 'Pickup' : 'Delivery'} POD
            </a>
          ) : (
            <button
              onClick={() => podMutation.mutate()}
              disabled={podMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors disabled:opacity-50"
            >
              {podMutation.isPending
                ? <Loader2 size={11} className="animate-spin" />
                : <Download size={11} />
              }
              Generate POD
            </button>
          )}
        </div>
      )}

      {/* Signature modal */}
      {sigModal && (
        <SignaturePadModal
          onSave={(dataUrl, name) => sigMutation.mutate({ dataUrl, name })}
          onClose={() => setSigModal(false)}
          saving={sigMutation.isPending}
        />
      )}
    </div>
  );
}
