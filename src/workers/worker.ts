// src/workers/worker.ts

// --- Добавлена директива для типизации Web Worker ---
/// <reference lib="webworker" />
// --- /Добавлена директива ---

// Теперь TypeScript знает о DedicatedWorkerGlobalScope
declare const self: DedicatedWorkerGlobalScope;

// --- Определение типов ---
interface IntermediateResult {
  phone: string;
  message: string;
  SMS?: string;
  VK?: string;
  WhatsApp?: string;
  // Поля, которые будут вычислены позже
  channelsCount?: number;
  overall?: string;
}

interface ChannelStat {
  success: number;
  failed: number;
}

interface WhatsAppStat extends ChannelStat {
  pending: number;
}

interface ChannelStats {
  vk: ChannelStat;
  sms: ChannelStat;
  whatsapp: WhatsAppStat;
}

interface DeliverySummary {
  total: number;
  failed: number;
  completelyFailed: number;
  whatsappPending: number;
  channelStats: ChannelStats;
}

interface AnalysisData {
  smsVkData: any[];
  whatsappData: any[];
  successKeywords: string[];
  failKeywords: string[];
}

interface AnalysisResult {
  results: IntermediateResult[];
  summary: DeliverySummary;
}
// --- /Определение типов ---

self.onmessage = function(e: MessageEvent<AnalysisData>) { // Добавлен тип для e
  const { smsVkData, whatsappData, successKeywords, failKeywords } = e.data;

  // --- Вспомогательные функции ---
  const isSuccess = (status: string | undefined): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    if (failKeywords.some((kw: string) => s.includes(kw))) return false;
    return successKeywords.some((kw: string) => s.includes(kw));
  };

  const isFail = (status: string | undefined): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    return failKeywords.some((kw: string) => s.includes(kw));
  };

  const getTextFromContent = (content: any): string => {
     if (typeof content === 'string') return content;
     if (content && typeof content === 'object' && content.text) return content.text;
     return '';
  };
  // --- /Вспомогательные функции ---

  // --- Сопоставление данных ---
  // Создаем мапу для результатов, ключ - phone__message
  const resultsMap = new Map<string, IntermediateResult>();

  // Обрабатываем SMS/VK данные
  (smsVkData || []).forEach((row: any) => {
    const phone = String(row["Номер назначения"] || "").trim();
    const message = String(row["Сообщение"] || "").trim();
    const status = String(row["Статус"] || "").trim();
    const msgType = String(row["Тип сообщения"] || "").trim().toLowerCase();

    const key = `${phone}__${message}`;
    if (!resultsMap.has(key)) {
      // Инициализируем объект с пустыми полями для всех каналов и вычисляемых полей
      resultsMap.set(key, { phone, message, SMS: undefined, VK: undefined, WhatsApp: undefined, channelsCount: undefined, overall: undefined });
    }
    const item = resultsMap.get(key)!;

    if (msgType === "sms") {
        item.SMS = status;
    }
    // Если в файле SMS/VK будут и VK сообщения, можно добавить логику здесь
    // else if (msgType === "vk") item.VK = status;
  });

  // Обрабатываем WhatsApp данные
  (whatsappData || []).forEach((row: any) => {
    const phone = String(row["Телефон клиента"] || "").trim();
    const message = getTextFromContent(row["Содержание сообщения"]);
    const status = String(row["Статус доставки исходящего"] || "").trim();

    const key = `${phone}__${message}`;
    if (!resultsMap.has(key)) {
      // Инициализируем объект с пустыми полями для всех каналов и вычисляемых полей
      resultsMap.set(key, { phone, message, SMS: undefined, VK: undefined, WhatsApp: undefined, channelsCount: undefined, overall: undefined });
    }
    const item = resultsMap.get(key)!;
    item.WhatsApp = status;
  });
  // --- /Сопоставление данных ---

  // --- Формирование итогового массива и подсчет статистики ---
  let total = 0;
  let failed = 0;
  let completelyFailed = 0;
  let whatsappPending = 0;
  const channelStats: ChannelStats = {
    vk: { success: 0, failed: 0 },
    sms: { success: 0, failed: 0 },
    whatsapp: { success: 0, failed: 0, pending: 0 }
  };

  const results: IntermediateResult[] = Array.from(resultsMap.values()).map(item => {
    total++;
    // Вычисляем и устанавливаем channelsCount
    item.channelsCount = [item.SMS, item.VK, item.WhatsApp].filter(c => c !== undefined).length;

    // Подсчет статистики по каналам
    if (item.VK) {
      if (isSuccess(item.VK)) channelStats.vk.success++;
      if (isFail(item.VK)) channelStats.vk.failed++;
    }
    if (item.SMS) {
      if (isSuccess(item.SMS)) channelStats.sms.success++;
      if (isFail(item.SMS)) channelStats.sms.failed++;
    }
    if (item.WhatsApp) {
      if (isSuccess(item.WhatsApp)) channelStats.whatsapp.success++;
      if (isFail(item.WhatsApp)) channelStats.whatsapp.failed++;
      if (item.WhatsApp.toLowerCase().includes("отправлено")) {
        channelStats.whatsapp.pending++;
        whatsappPending++;
      }
    }

    // Определение overall статуса
    // Пример простой логики: если хотя бы один канал успешен - "Успешно", иначе "Не доставлено"
    const statuses = [item.VK, item.SMS, item.WhatsApp];
    const anyDelivered = statuses.some(s => s && isSuccess(s));
    const allFailed = statuses.every(s => !s || isFail(s)); // Если статус не определен, считаем как неудачу

    item.overall = anyDelivered ? "✅ Успешно" : "❌ Не доставлено";

    if (!anyDelivered) failed++;
    if (allFailed) completelyFailed++;

    return item; // item теперь имеет тип IntermediateResult, включая channelsCount и overall
  });

  const summary: DeliverySummary = {
    total,
    failed,
    completelyFailed,
    whatsappPending,
    channelStats
  };
  // --- /Формирование итогового массива и подсчет статистики ---

  // --- Исправленный postMessage ---
  self.postMessage({ type: "analysis_done", data: { results, summary } }); // Добавлено имя свойства 'data'
  // --- /Исправленный postMessage ---
};

// --- Добавлен экспорт ---
export {};
// --- /Добавлен экспорт ---