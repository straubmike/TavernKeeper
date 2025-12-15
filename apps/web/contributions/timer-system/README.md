# Timer System

## Overview

The Timer System manages time-based event delivery for dungeon runs. Events are calculated deterministically immediately, but are delivered to the frontend over time at 6-second intervals.

## Key Concepts

1. **Deterministic Calculation**: All dungeon outcomes are calculated immediately and synchronously
2. **Time-Based Delivery**: Events are scheduled with `scheduled_delivery_time` timestamps
3. **Independent Timer**: Events deliver even if the user isn't actively watching
4. **Sequential Scheduling**: Events are scheduled with 6-second intervals

## Usage

### Schedule Events

```typescript
import { scheduleEvent, scheduleEventsSequentially } from '@/contributions/timer-system/code/services/timerService';

// Schedule a single event
const event = await scheduleEvent({
  runId: 'run-123',
  type: 'combat_turn',
  payload: { attacker: 'hero-1', target: 'monster-1', damage: 10 },
  delaySeconds: 6, // Deliver 6 seconds from now
});

// Schedule multiple events sequentially
const startTime = new Date();
const events = await scheduleEventsSequentially([
  { runId: 'run-123', type: 'room_entry', payload: { roomId: 'room-1' } },
  { runId: 'run-123', type: 'combat_start', payload: { encounter: '2x Skeleton' } },
  { runId: 'run-123', type: 'combat_turn', payload: { turn: 1 } },
], startTime);
```

### Get Events Ready to Deliver

```typescript
import { getEventsReadyToDeliver } from '@/contributions/timer-system/code/services/timerService';

// Get all events ready to deliver
const readyEvents = await getEventsReadyToDeliver();

// Get events for a specific run
const runEvents = await getEventsReadyToDeliver('run-123');
```

### Mark Events as Delivered

```typescript
import { markEventsAsDelivered } from '@/contributions/timer-system/code/services/timerService';

// Mark events as delivered after sending to frontend
await markEventsAsDelivered(['event-1', 'event-2']);
```

## Integration Points

1. **Dungeon Run Service**: After deterministic calculation, schedule events with sequential timestamps
2. **Timer Worker**: Background process that checks for events ready to deliver
3. **API Endpoint**: `/api/runs/[id]/events` filters events by `scheduled_delivery_time <= now()`

## Database Schema

Events are stored in `world_events` table with:
- `scheduled_delivery_time`: When the event should be delivered
- `delivered`: Whether the event has been delivered to frontend

## Configuration

Default configuration:
- Event interval: 6 seconds
- Batch size: 100 events per batch
- Check interval: 1 second (how often timer worker checks)

