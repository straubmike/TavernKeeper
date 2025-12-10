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
    console.log(`[Events API] Fetching events for run ${id}${since ? ` since ${since}` : ''}`);
    let query = supabase
      .from('world_events')
      .select('*')
      .eq('run_id', id)
      .order('timestamp', { ascending: true });

    // If since is provided, only get events after that time
    if (since) {
      query = query.gt('timestamp', since);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error(`[Events API] Error fetching run events for ${id}:`, error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    console.log(`[Events API] Found ${events?.length || 0} events for run ${id}`);
    if (events && events.length > 0) {
      console.log(`[Events API] Sample event:`, JSON.stringify(events[0], null, 2));
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
