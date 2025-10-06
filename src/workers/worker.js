// workers/worker.js
self.onmessage = function(e) {
  const { smsVkData, whatsappData, successKeywords, failKeywords } = e.data;

  // --- Вспомогательные функции ---
  const isSuccess = (status) => {
    if (!status) return false;
    const s = status.toLowerCase();
    if (failKeywords.some(kw => s.includes(kw))) return false;
    return successKeywords.some(kw => s.includes(kw));
  };

  const isFail = (status) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return failKeywords.some(kw => s.includes(kw));
  };

  const getTextFromContent = (content) => {
     if (typeof content === 'string') return content;
     if (content && typeof content === 'object' && content.text) return content.text;
     return '';
  };
  // --- /Вспомогательные функции ---

  // --- Сопоставление данных ---
  // Создаем мапу для результатов, ключ - phone__message
  const resultsMap = new Map();

  // Обрабатываем SMS/VK данные
  smsVkData.forEach(row => {
    const phone = String(row["Номер назначения"] || "").trim();
    const message = String(row["Сообщение"] || "").trim();
    const status = String(row["Статус"] || "").trim();
    const msgType = String(row["Тип сообщения"] || "").trim().toLowerCase();

    const key = `${phone}__${message}`;
    if (!resultsMap.has(key)) {
      resultsMap.set(key, { phone, message, SMS: undefined, VK: undefined, WhatsApp: undefined });
    }
    const item = resultsMap.get(key);

    if (msgType === "sms") {
        item.SMS = status;
    }
    // Если в файле SMS/VK будут и VK сообщения, можно добавить логику здесь
    // else if (msgType === "vk") item.VK = status;
  });

  // Обрабатываем WhatsApp данные
  whatsappData.forEach(row => {
    const phone = String(row["Телефон клиента"] || "").trim();
    const message = getTextFromContent(row["Содержание сообщения"]);
    const status = String(row["Статус доставки исходящего"] || "").trim();

    const key = `${phone}__${message}`;
    if (!resultsMap.has(key)) {
      resultsMap.set(key, { phone, message, SMS: undefined, VK: undefined, WhatsApp: undefined });
    }
    const item = resultsMap.get(key);
    item.WhatsApp = status;
  });
  // --- /Сопоставление данных ---

  // --- Формирование итогового массива и подсчет статистики ---
  let total = 0;
  let failed = 0;
  let completelyFailed = 0;
  let whatsappPending = 0;
  const channelStats = {
    vk: { success: 0, failed: 0 },
    sms: { success: 0, failed: 0 },
    whatsapp: { success: 0, failed: 0, pending: 0 }
  };

  const results = Array.from(resultsMap.values()).map(item => {
    total++;
    const channelsCount = [item.SMS, item.VK, item.WhatsApp].filter(c => c !== undefined).length;
    item.channelsCount = channelsCount;

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

    return item;
  });

  const summary = {
    total,
    failed,
    completelyFailed,
    whatsappPending,
    channelStats
  };
  // --- /Формирование итогового массива и подсчет статистики ---

  self.postMessage({ type: "analysis_done", data: { results, summary } });
};