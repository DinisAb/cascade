// worker.js
self.onmessage = function(e) {
  const { data, successKeywords, failKeywords } = e.data;
  // XLSX не работает в воркере напрямую, поэтому предполагаем, что сюда уже пришёл массив json
  const cascades = new Map();
  let processed = 0;
  const totalRows = data.length;
  for (let i = 0; i < totalRows; i++) {
    const row = data[i];
    const phone = String(row["Номер назначения"] || "").trim();
    const message = String(row["Сообщение"] || "").trim();
    const msgType = String(row["Тип сообщения"] || "").trim().toLowerCase();
    const status = String(row["Статус"] || "").trim();
    const key = `${phone}__${message}`;
    if (!cascades.has(key)) cascades.set(key, {});
    const item = cascades.get(key);
    if (msgType === "vk") item.VK = status;
    else if (msgType === "sms") item.SMS = status;
    else if (msgType === "whatsapp") item.WhatsApp = status;
    processed++;
    if (processed % 10000 === 0 || processed === totalRows) {
      self.postMessage({ type: "progress", processed, totalRows });
    }
  }
  // Формируем результат
  const results = Array.from(cascades.entries()).map(([key, ch]) => {
    const [phone, message] = key.split("__");
    const channelsCount = Object.keys(ch).length;
    const statuses = [ch.VK, ch.SMS, ch.WhatsApp];
    const delivered = statuses.some(s => {
      if (!s) return false;
      const str = s.toLowerCase();
      if (failKeywords.some(kw => str.includes(kw))) return false;
      return successKeywords.some(kw => str.includes(kw));
    });
    const allFailed = statuses.every(s => {
      if (!s) return false;
      const str = s.toLowerCase();
      return failKeywords.some(kw => str.includes(kw));
    });
    let overall = delivered && !allFailed ? "✅ Успешно" : "❌ Не доставлено";
    if (!delivered && channelsCount < 3) overall += " (неполный каскад)";
    return { phone, message, channelsCount, ...ch, overall };
  });
  self.postMessage({ type: "done", results });
};
