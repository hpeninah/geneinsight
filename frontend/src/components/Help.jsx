import { Badge, Tooltip } from '@mantine/core';

export function Help({ text }) {
  return (
    <Tooltip label={text} multiline w={260}>
      <Badge size="xs" variant="light" style={{ cursor: 'help' }}>
        ?
      </Badge>
    </Tooltip>
  );
}