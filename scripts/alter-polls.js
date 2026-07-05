"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var postgres_1 = require("postgres");
var dotenv_1 = require("dotenv");
dotenv_1.default.config({ path: '.env.local' });
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var sql, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sql = (0, postgres_1.default)(process.env.DATABASE_URL, { prepare: false });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, 7, 9]);
                    return [4 /*yield*/, sql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;"], ["ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;"])))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, sql(templateObject_2 || (templateObject_2 = __makeTemplateObject(["ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;"], ["ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;"])))];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, sql(templateObject_3 || (templateObject_3 = __makeTemplateObject(["ALTER TABLE polls ALTER COLUMN event_id DROP NOT NULL;"], ["ALTER TABLE polls ALTER COLUMN event_id DROP NOT NULL;"])))];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, sql(templateObject_4 || (templateObject_4 = __makeTemplateObject(["ALTER TABLE events ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;"], ["ALTER TABLE events ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;"])))];
                case 5:
                    _a.sent();
                    console.log("Success: Added all columns");
                    return [3 /*break*/, 9];
                case 6:
                    e_1 = _a.sent();
                    if (e_1.message.includes('already exists')) {
                        console.log("Column already exists");
                    }
                    else {
                        console.error(e_1);
                    }
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, sql.end()];
                case 8:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    });
}
main();
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
