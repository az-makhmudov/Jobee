export type UUID = string;

export type ISOTimestamp = string;

export interface BaseEntity {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
}
