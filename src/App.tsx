/**
 * Приложение для анализа каскадов сообщений через различные каналы связи (VK, SMS, WhatsApp)
 * Позволяет загружать Excel-файлы и анализировать статусы доставки сообщений
 */

import React, { useCallback, useState, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";

/**
 * Интерфейс для хранения статусов доставки по каждому каналу связи
 */
interface ChannelStatus {
  VK?: string;
  SMS?: string;
  WhatsApp?: string;
}

interface CascadeRow extends ChannelStatus {
  /** Номер телефона получателя */
  phone: string;
  /** Текст сообщения */
  message: string;
  /** Количество использованных каналов связи */
  channelsCount: number;
  /** Общий статус доставки */
  overall: string;
}

/** Интерфейс для статистики по одному каналу */
interface ChannelStat {
  success: number;
  failed: number;
}

/** Расширенная статистика для WhatsApp */
interface WhatsAppStat extends ChannelStat {
  pending: number;
}

/** Интерфейс для общей статистики по каналам */
interface ChannelStats {
  vk: ChannelStat;
  sms: ChannelStat;
  whatsapp: WhatsAppStat;
}

/** Интерфейс для общей статистики */
interface DeliverySummary {
  total: number;
  failed: number;
  completelyFailed: number;
  whatsappPending: number;
  channelStats: ChannelStats;
}

/**
 * Основной компонент приложения
 * Обрабатывает загрузку файлов, анализ данных и отображение результатов
 */
export default function App() {
  /** Максимальное количество отображаемых строк в таблице */
  const MAX_VISIBLE_ROWS = 1000;
  /** Количество обработанных строк (для прогресс-бара) */
  const [processedRows, setProcessedRows] = useState(0);
  /** Общее количество строк в файле */
  const [totalRowsState, setTotalRowsState] = useState(0);
  /** Массив обработанных строк с результатами анализа */
  const [rows, setRows] = useState<CascadeRow[]>([]);
  /** Общая статистика по всем сообщениям */
  const [summary, setSummary] = useState<DeliverySummary>({
    total: 0,
    failed: 0,
    completelyFailed: 0, // все каналы не доставлены
    whatsappPending: 0, // WhatsApp в статусе "Отправлено"
    channelStats: { // статистика по каждому каналу
      vk: { success: 0, failed: 0 },
      sms: { success: 0, failed: 0 },
      whatsapp: { success: 0, failed: 0, pending: 0 }
    }
  });
  /** Флаг процесса загрузки */
  const [loading, setLoading] = useState(false);
  /** Процент выполнения обработки */
  const [progress, setProgress] = useState(0);
  /** Оценка оставшегося времени */
  const [estimatedTime, setEstimatedTime] = useState("");

  /** Ключевые слова, указывающие на успешную доставку */
  const successKeywords = useMemo(() => ["доставлено", "прочитано", "прочитан"], []);
  /** Ключевые слова, указывающие на ошибку доставки */
  const failKeywords = useMemo(() => ["не доставлено", "не отправлено"], []);

  /** Проверяет успешность доставки по статусу */
  const isSuccess = useCallback((status: string | undefined): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    // Если статус содержит плохое слово — это не успех
    if (failKeywords.some((kw: string) => s.includes(kw))) return false;
    return successKeywords.some((kw: string) => s.includes(kw));
  }, [failKeywords, successKeywords]);

  /** Проверяет наличие ошибки доставки по статусу */
  const isFail = useCallback((status: string | undefined): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    return failKeywords.some((kw: string) => s.includes(kw));
  }, [failKeywords]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    setLoading(true);
    setProgress(0);
    setEstimatedTime("");

    const startTime = Date.now();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet);
        setTotalRowsState(json.length);

        // Web Worker
        const worker = new window.Worker("/worker.js");
        worker.postMessage({
          data: json,
          successKeywords,
          failKeywords
        });
        worker.onmessage = (event) => {
          if (event.data.type === "progress") {
            setProcessedRows(event.data.processed);
            const percent = Math.round((event.data.processed / event.data.totalRows) * 100);
            setProgress(percent);
            // Оценка времени (упрощённо)
            const elapsed = Date.now() - startTime;
            const remaining = (elapsed / event.data.processed) * (event.data.totalRows - event.data.processed) / 1000;
            setEstimatedTime(remaining > 60 ? `${Math.round(remaining / 60)} мин` : `${Math.round(remaining)} сек`);
          }
          if (event.data.type === "done") {
            const results = event.data.results;
            const total = results.length;
            
            // Подсчет статистики
            const stats = results.reduce((acc: DeliverySummary, r: CascadeRow) => {
              // Общие ошибки доставки
              if (r.overall.includes("Не доставлено")) acc.failed++;
              
              // Полный провал (все каналы не доставлены)
              const allFailed = (!r.VK || isFail(r.VK)) && 
                              (!r.SMS || isFail(r.SMS)) && 
                              (!r.WhatsApp || isFail(r.WhatsApp));
              if (allFailed) acc.completelyFailed++;

              // WhatsApp в статусе "Отправлено"
              if (r.WhatsApp?.toLowerCase().includes("отправлено")) acc.whatsappPending++;

              // Статистика по каналам
              if (r.VK) {
                if (isSuccess(r.VK)) acc.channelStats.vk.success++;
                if (isFail(r.VK)) acc.channelStats.vk.failed++;
              }
              if (r.SMS) {
                if (isSuccess(r.SMS)) acc.channelStats.sms.success++;
                if (isFail(r.SMS)) acc.channelStats.sms.failed++;
              }
              if (r.WhatsApp) {
                if (isSuccess(r.WhatsApp)) acc.channelStats.whatsapp.success++;
                if (isFail(r.WhatsApp)) acc.channelStats.whatsapp.failed++;
                if (r.WhatsApp.toLowerCase().includes("отправлено")) acc.channelStats.whatsapp.pending++;
              }

              return acc;
            }, {
              total,
              failed: 0,
              completelyFailed: 0,
              whatsappPending: 0,
              channelStats: {
                vk: { success: 0, failed: 0 },
                sms: { success: 0, failed: 0 },
                whatsapp: { success: 0, failed: 0, pending: 0 }
              }
            });

            setRows(results);
            setSummary(stats);
            setLoading(false);
            worker.terminate();
          }
        };
      } catch (err) {
        console.error("Ошибка при обработке файла:", err);
        setRows([]);
        setSummary({
          total: 0,
          failed: 0,
          completelyFailed: 0,
          whatsappPending: 0,
          channelStats: {
            vk: { success: 0, failed: 0 },
            sms: { success: 0, failed: 0 },
            whatsapp: { success: 0, failed: 0, pending: 0 }
          }
        });
        alert("Не удалось прочитать файл. Проверьте формат таблицы.");
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  }, [failKeywords, successKeywords, isFail, isSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
  });

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cascades");
    XLSX.writeFile(wb, "cascade_report.xlsx");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center mx-auto">📡 Анализ каскадов VK / SMS / WhatsApp</h1>

      {/* Поле загрузки */}
      {!loading && rows.length === 0 && (
        <div
          {...getRootProps()}
          className={`w-full max-w-md p-6 border-2 border-dashed rounded-2xl text-center transition cursor-pointer shadow-sm md:w-96 ${
            isDragActive ? "bg-green-100 border-green-400" : "bg-white border-gray-300 hover:border-blue-400"
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-gray-600">
            {isDragActive ? "Отпустите файл..." : "Перетащите Excel-файл или нажмите для выбора"}
          </p>
        </div>
      )}

      {/* Анимация загрузки с прогрессом */}
      {loading && (
        <div className="flex flex-col items-center justify-center mt-20 w-full max-w-md">
          <div className="w-16 h-16 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-lg text-gray-700 animate-pulse">Обработка файла... {progress}%</p>
          <p className="text-sm text-gray-500">Обработано {processedRows} из {totalRowsState}</p>
          <p className="text-sm text-gray-500">Осталось примерно {estimatedTime}</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {/* Результаты */}
      {!loading && summary.total > 0 && (
        <div className="mt-8 bg-white rounded-xl p-6 shadow-lg w-full max-w-6xl animate-fade-in">
          <h2 className="text-xl font-semibold mb-4 text-gray-700 text-center mx-auto">📊 Результаты анализа</h2>

          <div className="space-y-4">
            {/* Основная статистика */}
            <div className="flex flex-col gap-4 md:flex-row md:gap-6">
              <div className="p-3 bg-green-100 rounded-xl text-center flex-1">
                <p className="text-sm text-gray-600">Всего каскадов</p>
                <p className="text-xl font-bold text-green-700">{summary.total}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl text-center flex-1">
                <p className="text-sm text-gray-600">Не доставлено (хотя бы 1 канал)</p>
                <p className="text-xl font-bold text-red-700">{summary.failed}</p>
                <p className="text-sm text-gray-500">
                  {((summary.failed / summary.total) * 100).toFixed(2)}%
                </p>
              </div>
              <div className="p-3 bg-red-200 rounded-xl text-center flex-1">
                <p className="text-sm text-gray-600">Полный провал (все каналы)</p>
                <p className="text-xl font-bold text-red-800">{summary.completelyFailed}</p>
                <p className="text-sm text-gray-500">
                  {((summary.completelyFailed / summary.total) * 100).toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Статистика по каналам */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl">
                <h3 className="font-semibold mb-2">VK</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Успешно</p>
                    <p className="text-lg font-bold text-green-600">{summary.channelStats.vk.success}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Ошибки</p>
                    <p className="text-lg font-bold text-red-600">{summary.channelStats.vk.failed}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-xl">
                <h3 className="font-semibold mb-2">SMS</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Успешно</p>
                    <p className="text-lg font-bold text-green-600">{summary.channelStats.sms.success}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Ошибки</p>
                    <p className="text-lg font-bold text-red-600">{summary.channelStats.sms.failed}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-xl">
                <h3 className="font-semibold mb-2">WhatsApp</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Успешно</p>
                    <p className="text-lg font-bold text-green-600">{summary.channelStats.whatsapp.success}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Ошибки</p>
                    <p className="text-lg font-bold text-red-600">{summary.channelStats.whatsapp.failed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Отправлено</p>
                    <p className="text-lg font-bold text-yellow-600">{summary.channelStats.whatsapp.pending}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={exportToExcel}
            className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
          >
            💾 Скачать отчёт
          </button>

          {rows.length > MAX_VISIBLE_ROWS && (
            <div className="mb-2 text-sm text-yellow-700 bg-yellow-100 rounded px-3 py-2">
              Показаны первые {MAX_VISIBLE_ROWS} строк из {rows.length}. Для полного отчёта используйте экспорт.
            </div>
          )}

          <div className="overflow-auto max-h-[500px] border rounded-xl overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-max">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border p-2">Телефон</th>
                  <th className="border p-2">Сообщение</th>
                  <th className="border p-2">VK</th>
                  <th className="border p-2">SMS</th>
                  <th className="border p-2">WhatsApp</th>
                  <th className="border p-2">Каналы (кол-во)</th>
                  <th className="border p-2">Итог</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, MAX_VISIBLE_ROWS).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border p-2">{r.phone}</td>
                    <td className="border p-2">{r.message}</td>
                    <td className={`border p-2 ${isSuccess(r.VK) ? "text-green-600" : isFail(r.VK) ? "text-red-500" : ""}`}>
                      {r.VK || "-"}
                    </td>
                    <td className={`border p-2 ${isSuccess(r.SMS) ? "text-green-600" : isFail(r.SMS) ? "text-red-500" : ""}`}>
                      {r.SMS || "-"}
                    </td>
                    <td className={`border p-2 ${isSuccess(r.WhatsApp) ? "text-green-600" : isFail(r.WhatsApp) ? "text-red-500" : ""}`}>
                      {r.WhatsApp || "-"}
                    </td>
                    <td className="border p-2 text-center">{r.channelsCount}/3</td>
                    <td className={`border p-2 font-semibold ${r.overall.includes("Не") ? "text-red-600" : "text-green-700"}`}>
                      {r.overall}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}