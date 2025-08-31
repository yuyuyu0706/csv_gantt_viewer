// js/globals.d.ts
declare function html2canvas(el: HTMLElement, opts?: any): Promise<HTMLCanvasElement>;

interface HTMLElement {
  __onHSync?: (e: Event) => void;
  __headerSync?: () => void;
}

interface Window {
  updateToggleAllBtn?: () => void;
  updateGlobalButtons?: () => void;
  // 既存コードで window. 経由の利用がある場合の暫定宣言
  prioClassText?: (p: any) => [string, string];
  statusColor?: (s: any) => string;
  appendDateLabels?: (
    containerEl: Element, startX: number, endX: number, midY: number, startDate: Date, endDate: Date
  ) => void;
  cmpByStartThenName?: (a: any, b: any) => number;
  __isBoundary?: (d: Date, mode: string) => boolean;
}
