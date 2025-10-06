// src/components/ResultsView.tsx
import React from 'react';
import { FileProcessorState, FileProcessorActions } from '../hooks/useFileProcessor';

interface ResultsViewProps {
  state: FileProcessorState;
  onExport: FileProcessorActions['exportToExcel'];
  MAX_VISIBLE_ROWS: number;
}

const ResultsView: React.FC<ResultsViewProps> = ({ state, onExport, MAX_VISIBLE_ROWS }) => {
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

  return (
    <div className="mt-8 bg-white rounded-xl p-6 shadow-lg w-full max-w-6xl animate-fade-in">
      <h2 className="text-xl font-semibold mb-4 text-gray-700 text-center mx-auto">Результаты анализа</h2>

      <div className="space-y-4">
        {/* Основная статистика */}
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          <div className="p-3 bg-green-100 rounded-xl text-center flex-1">
            <p className="text-sm text-gray-600">Всего каскадов</p>
            <p className="text-xl font-bold text-green-700">{state.summary.total}</p>
          </div>
          <div className="p-3 bg-red-100 rounded-xl text-center flex-1">
            <p className="text-sm text-gray-600">Не доставлено (хотя бы 1 канал)</p>
            <p className="text-xl font-bold text-red-700">{state.summary.failed}</p>
            <p className="text-sm text-gray-500">
              {((state.summary.failed / state.summary.total) * 100).toFixed(2)}%
            </p>
          </div>
          <div className="p-3 bg-red-200 rounded-xl text-center flex-1">
            <p className="text-sm text-gray-600">Полный провал (все каналы)</p>
            <p className="text-xl font-bold text-red-800">{state.summary.completelyFailed}</p>
            <p className="text-sm text-gray-500">
              {((state.summary.completelyFailed / state.summary.total) * 100).toFixed(2)}%
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
                <p className="text-lg font-bold text-green-600">{state.summary.channelStats.vk.success}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Ошибки</p>
                <p className="text-lg font-bold text-red-600">{state.summary.channelStats.vk.failed}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-xl">
            <h3 className="font-semibold mb-2">SMS</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <p className="text-sm text-gray-600">Успешно</p>
                <p className="text-lg font-bold text-green-600">{state.summary.channelStats.sms.success}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Ошибки</p>
                <p className="text-lg font-bold text-red-600">{state.summary.channelStats.sms.failed}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-xl">
            <h3 className="font-semibold mb-2">WhatsApp</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-sm text-gray-600">Успешно</p>
                <p className="text-lg font-bold text-green-600">{state.summary.channelStats.whatsapp.success}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Ошибки</p>
                <p className="text-lg font-bold text-red-600">{state.summary.channelStats.whatsapp.failed}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Отправлено</p>
                <p className="text-lg font-bold text-yellow-600">{state.summary.channelStats.whatsapp.pending}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onExport}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
      >
        💾
      </button>

      {state.rows.length > MAX_VISIBLE_ROWS && (
        <div className="mb-2 text-sm text-yellow-700 bg-yellow-100 rounded px-3 py-2">
          Показаны первые {MAX_VISIBLE_ROWS} строк из {state.rows.length}. Для полного отчёта используйте экспорт.
        </div>
      )}

      <div className="overflow-auto max-h-[500px] border rounded-xl overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-max">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="border p-2">Телефон</th>
              <th className="border p-2">Сообщение</th>
              <th className="border p-2">SMS</th>
              <th className="border p-2">VK</th>
              <th className="border p-2">WhatsApp</th>
              <th className="border p-2">Каналы (кол-во)</th>
              <th className="border p-2">Итог</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.slice(0, MAX_VISIBLE_ROWS).map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-2">{r.phone}</td>
                <td className="border p-2">{r.message}</td>
                <td className={`border p-2 ${isSuccess(r.SMS) ? "text-green-600" : isFail(r.SMS) ? "text-red-500" : ""}`}>
                  {r.SMS || "-"}
                </td>
                <td className={`border p-2 ${isSuccess(r.VK) ? "text-green-600" : isFail(r.VK) ? "text-red-500" : ""}`}>
                  {r.VK || "-"}
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
  );
};

export default ResultsView;