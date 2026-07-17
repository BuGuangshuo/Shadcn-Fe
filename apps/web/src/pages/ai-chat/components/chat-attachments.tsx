import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@workspace/ui/components/attachment';
import { FileTextIcon, XIcon } from 'lucide-react';

import type { ChatAttachment, PendingAttachment } from '../types';
import { formatAttachmentSize, getAttachmentDescription, getAttachmentKind } from '../utils';

export function AttachmentList({ attachments }: { attachments: ChatAttachment[] }) {
  return (
    <div className="flex w-full flex-col items-end gap-2">
      {attachments.map((attachment) => (
        <Attachment key={attachment.id} className="w-full bg-background">
          <AttachmentMedia>
            <FileTextIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle title={attachment.name}>{attachment.name}</AttachmentTitle>
            <AttachmentDescription>{getAttachmentDescription(attachment)}</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      ))}
    </div>
  );
}

export function PendingAttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment;
  onRemove: (id: string) => void;
}) {
  const kind = getAttachmentKind(attachment);

  return (
    <Attachment state="idle" className="w-64 bg-background">
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle title={attachment.name}>{attachment.name}</AttachmentTitle>
        <AttachmentDescription>
          {kind} · {formatAttachmentSize(attachment.size)}
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction
          type="button"
          aria-label={`移除 ${attachment.name}`}
          onClick={() => onRemove(attachment.id)}
        >
          <XIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  );
}
