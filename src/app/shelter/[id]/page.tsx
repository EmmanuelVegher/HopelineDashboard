"use client";

import ShelterDetailsClient from "./shelter-details";
import { useParams } from "react-router-dom";

export default function ShelterDetailsPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>Shelter ID not found</div>;
  }

  return <ShelterDetailsClient shelterId={id} />;
}
