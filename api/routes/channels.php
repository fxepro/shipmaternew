<?php

use App\Models\Shipment;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Private channel: shipment.{id}
// Authorized for: the shipper, the assigned carrier, the receiver, and platform admins
Broadcast::channel('shipment.{shipmentId}', function (User $user, int $shipmentId) {
    $shipment = Shipment::find($shipmentId);
    if (!$shipment) return false;

    // shipper_id / carrier_id are companies; anyone in either company may listen
    return $user->isPlatformAdmin()
        || $user->isShipperOf($shipment)
        || $user->isCarrierOf($shipment)
        || (int) $shipment->receiver_id === (int) $user->id;
});
