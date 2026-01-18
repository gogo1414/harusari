import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription) {
      return NextResponse.json({ error: 'Missing subscription' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_push_subscriptions')
      .upsert({ 
        user_id: user.id, 
        subscription: subscription 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any, { 
        onConflict: 'user_id, subscription' 
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
  
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
  
      const { endpoint } = await request.json();
  
      if (!endpoint) {
        return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
      }
      
      // JSONB 내부의 endpoint 값을 기준으로 삭제하는 것은 복잡할 수 있으므로
      // 여기서는 user_id와 endpoint가 포함된 subscription을 찾아서 삭제하는 로직이 필요하지만,
      // Supabase(PostgreSQL)에서 JSONB 내부 필드 매칭: 
      // subscription->>'endpoint' = endpoint
      
      const { error } = await supabase
        .from('user_push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .filter('subscription->>endpoint', 'eq', endpoint);
  
      if (error) throw error;
  
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Unsubscription error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }
