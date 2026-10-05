"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROFILES = void 0;
exports.getProfile = getProfile;
exports.PROFILES = [
    { id: "dairy", name: { en: "Dairy", ar: "ألبان" }, tMin: 2, tMax: 6, rhMin: 55, rhMax: 85, reefer: true, shelfLifeH: 336, gasRelevant: false },
    { id: "produce", name: { en: "Fresh produce", ar: "خضروات وفواكه" }, tMin: 8, tMax: 12, rhMin: 80, rhMax: 95, reefer: true, shelfLifeH: 240, gasRelevant: true },
    { id: "frozen", name: { en: "Frozen meat", ar: "لحوم مجمدة" }, tMin: -22, tMax: -16, rhMin: 40, rhMax: 90, reefer: true, shelfLifeH: 2160, gasRelevant: true },
    { id: "seafood", name: { en: "Fresh seafood", ar: "مأكولات بحرية طازجة" }, tMin: 0, tMax: 4, rhMin: 70, rhMax: 95, reefer: true, shelfLifeH: 120, gasRelevant: true },
    { id: "pharma", name: { en: "Pharmaceuticals", ar: "أدوية" }, tMin: 2, tMax: 8, rhMin: 30, rhMax: 65, reefer: true, shelfLifeH: 4320, gasRelevant: false },
    { id: "dry", name: { en: "Dry goods", ar: "بضائع جافة" }, tMin: 5, tMax: 40, rhMin: 20, rhMax: 70, reefer: false, shelfLifeH: 8760, gasRelevant: false },
    { id: "electronics", name: { en: "Electronics", ar: "إلكترونيات" }, tMin: 5, tMax: 35, rhMin: 15, rhMax: 60, reefer: false, shelfLifeH: 8760, gasRelevant: false },
];
function getProfile(id) {
    return exports.PROFILES.find((p) => p.id === id);
}
