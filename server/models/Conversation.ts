import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface IConversation extends Document {
  bookingId?: Types.ObjectId;
  participants: Types.ObjectId[];
  lastMessage: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }],
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
