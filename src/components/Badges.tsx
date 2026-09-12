import { Badge } from './ui/badge';
import {
  CAMPAIGN_STATUS_LABEL,
  SEGMENT_SHORT,
  type CampaignStatus,
  type Segment,
  type SubscriberStatus,
} from '@/lib/types';

type Variant = 'ok' | 'warn' | 'secondary' | 'danger' | 'accent' | 'accent2' | 'outline';

const STATUS_VARIANT: Record<CampaignStatus, Variant> = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'warn',
  APPROVED: 'accent',
  SCHEDULED: 'accent2',
  RUNNING: 'accent',
  SENT: 'ok',
  CANCELLED: 'danger',
};

export function StatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{CAMPAIGN_STATUS_LABEL[status]}</Badge>;
}

const SEGMENT_VARIANT: Record<Segment, Variant> = {
  B2B_OPERATIVNI: 'outline',
  B2B_PROMOTIVNI: 'accent',
  B2C: 'accent2',
};

export function SegmentBadge({ segment }: { segment: Segment }) {
  return <Badge variant={SEGMENT_VARIANT[segment]}>{SEGMENT_SHORT[segment]}</Badge>;
}

const SUB_STATUS: Record<SubscriberStatus, { v: Variant; l: string }> = {
  ENABLED: { v: 'ok', l: 'Aktivan' },
  UNCONFIRMED: { v: 'warn', l: 'Čeka potvrdu' },
  PAUSED: { v: 'secondary', l: 'Pauziran' },
  BLOCKLISTED: { v: 'danger', l: 'Blokiran' },
};

export function SubscriberStatusBadge({ status }: { status: SubscriberStatus }) {
  return <Badge variant={SUB_STATUS[status].v}>{SUB_STATUS[status].l}</Badge>;
}
