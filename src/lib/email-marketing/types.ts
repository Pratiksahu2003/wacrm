export type SubscriberStatus = "subscribed" | "unsubscribed" | "bounced";
export type SubscriberSource = "csv" | "form" | "manual";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "failed";
export type RecipientStatus = "pending" | "sent" | "failed" | "skipped";

export interface AccountSmtpSettings {
  account_id: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_name: string | null;
  from_email: string;
  reply_to: string | null;
  verified_at: string | null;
  last_error: string | null;
  updated_at: string;
  /** Always false in API responses — password never leaves the server. */
  has_password: boolean;
}

export interface EmailList {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  public_slug: string;
  double_opt_in: boolean;
  subscriber_count: number;
  created_at: string;
  updated_at: string;
}

export interface EmailSubscriber {
  id: string;
  account_id: string;
  list_id: string;
  email: string;
  name: string | null;
  status: SubscriberStatus;
  source: SubscriberSource;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  account_id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  variables: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaign {
  id: string;
  account_id: string;
  list_id: string;
  template_id: string | null;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
