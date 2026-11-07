<?php

namespace App\Events;

use App\Models\GpsPing;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ShipmentPingReceived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public GpsPing $ping) {}

    public function broadcastOn(): array
    {
        $channels = [
            // Private — for authenticated carrier dashboard / shipper dashboard
            new PrivateChannel("load.{$this->ping->freight_job_id}"),
        ];

        // Public — for the unauthenticated public tracking page (/track/{token})
        $token = $this->ping->freightJob?->tracking_token;
        if ($token) {
            $channels[] = new Channel("tracking.{$token}");
        }

        return $channels;
    }

    // Keep the name aligned with what the frontend listens for.
    // LiveMap: channel.listen('.GpsPingReceived', cb)  ← leading dot = bypass namespace
    public function broadcastAs(): string
    {
        return 'GpsPingReceived';
    }

    public function broadcastWith(): array
    {
        return [
            'id'            => $this->ping->id,
            'freight_job_id' => $this->ping->freight_job_id,
            'lat'           => (float) $this->ping->lat,
            'lng'           => (float) $this->ping->lng,
            'speed'         => $this->ping->speed ? (float) $this->ping->speed : null,
            'eta'           => $this->ping->eta,
            'state_crossed' => null,   // computed & filled in future (reverse geocode delta)
            'timestamp'     => $this->ping->pinged_at?->toISOString(),
        ];
    }
}
