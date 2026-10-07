"use client";

import React, { createContext, useContext, useState } from "react";

export interface DirectOrderItem {
  productId: string;
  variantId?: string;
  nameEn: string;
  nameAr: string;
  nameFr: string;
  sku: string;
  price: number; // in DZD
  color?: string;
  size?: string;
  /** Arbitrary option selection, e.g. { Size: "M", Material: "Cotton" } */
  options?: Record<string, string>;
  optionLabel?: string;
  quantity: number;
  imageUrl?: string;
  availableStock?: number;
}

interface DirectOrderContextType {
  isOpen: boolean;
  item: DirectOrderItem | null;
  openDirectOrder: (item: DirectOrderItem) => void;
  closeDirectOrder: () => void;
}

const DirectOrderContext = createContext<DirectOrderContextType>({
  isOpen: false,
  item: null,
  openDirectOrder: () => {},
  closeDirectOrder: () => {},
});

export function DirectOrderProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [item, setItem] = useState<DirectOrderItem | null>(null);

  const openDirectOrder = (newItem: DirectOrderItem) => {
    setItem(newItem);
    setIsOpen(true);
  };

  const closeDirectOrder = () => {
    setIsOpen(false);
  };

  return (
    <DirectOrderContext.Provider value={{ isOpen, item, openDirectOrder, closeDirectOrder }}>
      {children}
    </DirectOrderContext.Provider>
  );
}

export function useDirectOrder() {
  return useContext(DirectOrderContext);
}
