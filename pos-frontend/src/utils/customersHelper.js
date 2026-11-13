export const extractCustomersFromOrders = (orders = []) => {
  const map = new Map();

  orders.forEach((order) => {
    const details = order.customerDetails || {};
    const rawName = (details.name || "").trim();
    const rawPhone = (details.phone || "").trim();
    const rawAddr = (details.deliveryAddress || "").trim();

    if (!rawName && !rawPhone) return;

    const normalizedPhone = rawPhone.replace(/\s+/g, "");
    const key = normalizedPhone || rawName.toLowerCase();
    const orderTotal = Number(order.bills?.totalWithTax || 0);
    const orderDate = order.orderDate || "";

    if (!map.has(key)) {
      map.set(key, {
        key,
        name: rawName || "Customer",
        phone: rawPhone,
        deliveryAddress: rawAddr,
        totalOrders: 1,
        totalSpent: orderTotal,
        lastOrderDate: orderDate,
      });
    } else {
      const existing = map.get(key);
      existing.totalOrders += 1;
      existing.totalSpent += orderTotal;
      if (!existing.name && rawName) existing.name = rawName;
      if (!existing.phone && rawPhone) existing.phone = rawPhone;
      if (!existing.deliveryAddress && rawAddr) existing.deliveryAddress = rawAddr;
      if (orderDate && (!existing.lastOrderDate || orderDate > existing.lastOrderDate)) {
        existing.lastOrderDate = orderDate;
        if (rawAddr) existing.deliveryAddress = rawAddr;
      }
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    (b.lastOrderDate || "").localeCompare(a.lastOrderDate || "")
  );
};

const escapeCsvValue = (value) => {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportCustomersToCsv = (customers = []) => {
  const headers = [
    "Customer Name",
    "Phone",
    "Delivery Address",
    "Total Orders",
    "Total Spent (GHS)",
    "Last Order Date",
  ];

  const rows = customers.map((c) => [
    c.name,
    c.phone,
    c.deliveryAddress,
    c.totalOrders,
    Number(c.totalSpent || 0).toFixed(2),
    c.lastOrderDate ? new Date(c.lastOrderDate).toISOString().slice(0, 10) : "",
  ]);

  const csvContent =
    "\uFEFF" +
    [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateTag = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute("download", `sideways-grillz-customers-${dateTag}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

