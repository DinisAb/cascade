// src/hooks/useFileProcessor.ts
import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import { CascadeRow, DeliverySummary, SmsVkRow, WhatsappRow, FileType } from '../types/types';

export interface FileProcessorState {
  smsVkData: SmsVkRow[];
  whatsappData: WhatsappRow[];
  smsVkLoaded: boolean;
  whatsappLoaded: boolean;
  analysisComplete: boolean;
  rows: CascadeRow[];
  summary: DeliverySummary;
  loading: boolean;
  progress: number;
  estimatedTime: string;
}

export interface FileProcessorActions {
  handleFileUpload: (file: File) => void;
  startAnalysis: () => void;
  exportToExcel: () => void;
}

const useFileProcessor = (): [FileProcessorState, FileProcessorActions] => {
  const [state, setState] = useState<FileProcessorState>({
    smsVkData: [],
    whatsappData: [],
    smsVkLoaded: false,
    whatsappLoaded: false,
    analysisComplete: false,
    rows: [],
    summary: {
      total: 0,
      failed: 0,
      completelyFailed: 0,
      whatsappPending: 0,
      channelStats: {
        vk: { success: 0, failed: 0 },
        sms: { success: 0, failed: 0 },
        whatsapp: { success: 0, failed: 0, pending: 0 }
      }
    },
    loading: false,
    progress: 0,
    estimatedTime: ""
  });

  const determineFileType = (jsonData: any[]): FileType => {
    if (jsonData.length === 0) return null;

    const firstRow = jsonData[0];
    const headers = Object.keys(firstRow);

    if (headers.includes('Номер назначения') && headers.includes('Сообщение') && headers.includes('Статус')) {
        const hasSmsType = jsonData.some((row: any) => row['Тип сообщения'] === 'SMS');
        if(hasSmsType) return 'smsVk';
    }
    if (headers.includes('Телефон клиента') && headers.includes('Содержание сообщения') && headers.includes('Статус доставки исходящего')) {
        const hasWhatsAppChannel = jsonData.some((row: any) => row['Канал'] === 'WhatsApp');
        if(hasWhatsAppChannel) return 'whatsapp';
    }
    return null;
  };

  const isSuccess = (status: string | undefined): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    const failKeywords = ["не доставлено", "не отправлено"];
    if (failKeywords.some((kw: string) => s.includes(kw))) return false;
    const successKeywords = ["доставлено", "прочитано", "прочитан"];
    return successKeywords.some((kw: string) => s.includes(kw));
  };

  const isFail = (status: string | undefined): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    const failKeywords = ["не доставлено", "не отправлено"];
    return failKeywords.some((kw: string) => s.includes(kw));
  };

  const handleFileUpload = useCallback((file: File) => {
    setState(prev => ({ ...prev, loading: true, progress: 0, estimatedTime: "" }));
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet);

        const fileType = determineFileType(json);

        if (fileType === 'smsVk' && !state.smsVkLoaded) {
          setState(prev => ({
            ...prev,
            smsVkData: json as SmsVkRow[],
            smsVkLoaded: true,
            loading: false
          }));
        } else if (fileType === 'whatsapp' && !state.whatsappLoaded) {
          setState(prev => ({
            ...prev,
            whatsappData: json as WhatsappRow[],
            whatsappLoaded: true,
            loading: false
          }));
        } else {
          alert(`Файл не распознан как SMS/VK или WhatsApp, или уже загружен. Тип: ${fileType}, SMS: ${state.smsVkLoaded}, WhatsApp: ${state.whatsappLoaded}`);
          setState(prev => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error("Ошибка при обработке файла:", err);
        alert("Не удалось прочитать файл. Проверьте формат таблицы.");
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    reader.readAsArrayBuffer(file);
  }, [state.smsVkLoaded, state.whatsappLoaded]);

  const startAnalysis = useCallback(() => {
    setState(prev => ({ ...prev, loading: true, progress: 0, estimatedTime: "" }));
    const worker = new Worker(new URL('../../public/worker.js', import.meta.url));

    worker.postMessage({
      smsVkData: state.smsVkData,
      whatsappData: state.whatsappData,
      successKeywords: ["доставлено", "прочитано", "прочитан"],
      failKeywords: ["не доставлено", "не отправлено"]
    });

    worker.onmessage = (event) => {
      if (event.data.type === "progress") {
        setState(prev => ({
          ...prev,
          progress: event.data.progress || 0,
          estimatedTime: event.data.estimatedTime || ""
        }));
      }
      if (event.data.type === "analysis_done") {
        const { results, summary } = event.data.data;
        setState(prev => ({
          ...prev,
          rows: results,
          summary: summary,
          analysisComplete: true,
          loading: false
        }));
        worker.terminate();
      }
    };

    worker.onerror = (error) => {
      console.error("Ошибка в Web Worker:", error);
      alert("Произошла ошибка при анализе данных.");
      setState(prev => ({ ...prev, loading: false }));
    };
  }, [state.smsVkData, state.whatsappData]);

  const exportToExcel = useCallback(() => {
    if (state.rows.length === 0) {
        alert("Нет данных для экспорта.");
        return;
    }
    // Импортируем xlsx локально, чтобы не было конфликта с worker.js
    import('xlsx').then(XLSX => {
        const ws = XLSX.utils.json_to_sheet(state.rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cascades");
        XLSX.writeFile(wb, "cascade_report.xlsx");
    });
  }, [state.rows]);

  return [state, { handleFileUpload, startAnalysis, exportToExcel }];
};

export default useFileProcessor;