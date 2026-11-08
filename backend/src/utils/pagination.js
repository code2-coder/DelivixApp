/**
 * Standardized Pagination Utility
 */
export const getPaginationOptions = (queryStr = {}, defaultLimit = 20, maxLimit = 100) => {
  const page = Math.max(1, parseInt(queryStr.page, 10) || 1);
  const rawLimit = parseInt(queryStr.limit || queryStr.perPage, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const formatPaginationResponse = (data = [], totalCount = 0, page = 1, limit = 20) => {
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    results: data.length,
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: totalPages,
      hasNextPage,
      hasPrevPage,
    },
  };
};

export default {
  getPaginationOptions,
  formatPaginationResponse,
};
