// src/types/types.ts

export interface ChannelStatus {
  VK?: string;
  SMS?: string;
  WhatsApp?: string;
}

export interface CascadeRow extends ChannelStatus {
  phone: string;
  message: string;
  channelsCount: number;
  overall: string;
}

export interface ChannelStat {
  success: number;
  failed: number;
}

export interface WhatsAppStat extends ChannelStat {
  pending: number;
}

export interface ChannelStats {
  vk: ChannelStat;
  sms: ChannelStat;
  whatsapp: WhatsAppStat;
}

export interface DeliverySummary {
  total: number;
  failed: number;
  completelyFailed: number;
  whatsappPending: number;
  channelStats: ChannelStats;
}

export interface SmsVkRow {
  "Номер назначения": string;
  "Сообщение": string;
  "Статус": string;
  "Тип сообщения"?: string; // Может быть, если VK и SMS в одном файле
  // ... другие поля
}

export interface WhatsappRow {
  "Телефон клиента": string;
  "Содержание сообщения": { text: string; type: string } | string;
  "Статус доставки исходящего": string;
  // ... другие поля
}

export type FileType = 'smsVk' | 'whatsapp' | null;