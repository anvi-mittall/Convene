export function getPaginationParams(query) {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = 10;
  } else if (limit > 50) {
    limit = 50;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function formatPaginatedResponse(items, total, page, limit) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    items,
    page,
    limit,
    total,
    totalPages
  };
}
