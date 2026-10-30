import { useEffect, useRef, type ReactNode } from 'react';

export function Overlay({ children, label, onClose }: {
    children: ReactNode;
    label: string;
    onClose: () => void;
}
) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => { const previous = document.activeElement as HTMLElement | null; const first = ref.current?.querySelector<HTMLElement>('button,input,select,textarea,[tabindex="0"]'); first?.focus(); const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
    } if (e.key === 'Tab') {
        const nodes = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]') || [])];
        const first = nodes[0], last = nodes.at(-1);
        if (!first) {
            e.preventDefault();
            return;
        }
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    } }; const node = ref.current; node?.addEventListener('keydown', handler); return () => { node?.removeEventListener('keydown', handler); previous?.focus(); }; }, [onClose]);
    return <div className="detail-overlay"><div ref={ref} className="detail-dialog" role="dialog" aria-modal="true" aria-label={label}>{children}</div></div>;
}
