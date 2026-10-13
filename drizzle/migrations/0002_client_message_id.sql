ALTER TABLE "messages" ADD COLUMN "client_message_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_client_idx" ON "messages" USING btree ("conversation_id","client_message_id");