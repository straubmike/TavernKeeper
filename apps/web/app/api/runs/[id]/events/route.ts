import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since'); // ISO timestamp to get events after this time

  try {
    const now = new Date().toISOString();
    
    // Query for events ready to deliver:
    // Return events where scheduled_delivery_time <= now() (regardless of delivered flag)
    // The delivered flag is just for timer worker cleanup, but frontend should still see events
    let query = supabase
      .from('world_events')
      .select('*')
      .eq('run_id', id)
      .order('scheduled_delivery_time', { ascending: true, nullsFirst: false })
      .order('timestamp', { ascending: true }); // Secondary sort by timestamp
    
    const { data: allEvents, error: queryError } = await query;
    
    if (queryError) {
      console.error(`[Events API] Error fetching run events for ${id}:`, queryError);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }
    
    // Filter events: include if scheduled_delivery_time is NULL or <= now()
    // Note: We return events regardless of delivered flag - the timer worker marking them
    // as delivered is just for cleanup, but the frontend should still receive them
    let events = (allEvents || []).filter(event => {
      if (!event.scheduled_delivery_time) {
        // Include error events and legacy events without scheduled time
        return true;
      }
      // Include scheduled events that are ready to deliver (time has passed)
      return new Date(event.scheduled_delivery_time) <= new Date(now);
    });

    // If since is provided, filter events after that time
    if (since) {
      events = events.filter(event => {
        const eventTime = event.scheduled_delivery_time || event.timestamp;
        return new Date(eventTime) > new Date(since);
      });
    }

    // Only log if there are events or if there's an issue
    if (events && events.length > 0) {
      console.log(`[Events API] Returning ${events.length} events for run ${id}`);
    }

    return NextResponse.json({ events: events || [] });
  } catch (error) {
    console.error('Error fetching run events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch run events' },
      { status: 500 }
    );
  }
}
