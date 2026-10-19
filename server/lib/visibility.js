// What the app is allowed to see.
// A movie shows in the app when it is published, its publish date (if any) has come,
// and its expiry date (if any) has not passed.
const visibleMovieQuery = () => {
  const now = new Date();
  return {
    publishStatus: { $ne: false },
    $and: [
      { $or: [{ publishDate: null }, { publishDate: { $lte: now } }] },
      { $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }] },
    ],
  };
};

const isMovieVisible = (m) => {
  if (!m || m.publishStatus === false) return false;
  const now = Date.now();
  if (m.publishDate && new Date(m.publishDate).getTime() > now) return false;
  if (m.expiryDate && new Date(m.expiryDate).getTime() <= now) return false;
  return true;
};

const visibleSeriesQuery = () => ({ isPublished: { $ne: false } });

module.exports = { visibleMovieQuery, isMovieVisible, visibleSeriesQuery };
