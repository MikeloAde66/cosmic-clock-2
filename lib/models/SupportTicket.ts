import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { TICKET_CATEGORIES, type TicketCategory } from '@/lib/supportTicketCategories';

export { TICKET_CATEGORIES, type TicketCategory };

export interface SupportTicketDoc extends Document {
  category: TicketCategory;
  description: string;
  email: string;
  status: 'open' | 'closed';
  createdAt: Date;
}

const SupportTicketSchema = new Schema<SupportTicketDoc>({
  category: { type: String, enum: TICKET_CATEGORIES, required: true },
  description: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
});

export default (mongoose.models.SupportTicket as Model<SupportTicketDoc>) ||
  mongoose.model<SupportTicketDoc>('SupportTicket', SupportTicketSchema);
