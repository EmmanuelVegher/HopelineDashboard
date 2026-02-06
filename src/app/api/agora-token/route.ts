import { type NextRequest, NextResponse } from "next/server";
import { generateToken04 } from '@zegocloud/zego-server-assistant';

export async function POST(request: NextRequest) {
  try {
    const { channelName, uid, role = 'publisher' } = await request.json();

    if (!channelName || uid === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters: channelName and uid' },
        { status: 400 }
      );
    }

    const appId = 1860960087; // ZegoCloud App ID
    const serverSecret = '26ab897c098ae902fec10e76e3d9bf1d'; // ZegoCloud Server Secret

    const expirationTimeInSeconds = 3600; // 1 hour validity

    // Token04 payload for RTC Room (login + optional publish)
    const payload = JSON.stringify({
      room_id: channelName,
      privilege: {
        1: 1, // loginRoom
        2: role === 'publisher' ? 1 : 0 // publishStream
      },
      stream_id_list: null
    });

    // generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload?)
    const token = generateToken04(appId, uid.toString(), serverSecret, expirationTimeInSeconds, payload);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating ZegoCloud token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
