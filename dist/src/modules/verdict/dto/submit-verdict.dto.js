"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmitVerdictDto = exports.VerdictEnumDto = void 0;
const class_validator_1 = require("class-validator");
var VerdictEnumDto;
(function (VerdictEnumDto) {
    VerdictEnumDto["guilty"] = "guilty";
    VerdictEnumDto["not_guilty"] = "not_guilty";
})(VerdictEnumDto || (exports.VerdictEnumDto = VerdictEnumDto = {}));
class SubmitVerdictDto {
}
exports.SubmitVerdictDto = SubmitVerdictDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitVerdictDto.prototype, "judgePlayerId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(VerdictEnumDto),
    __metadata("design:type", String)
], SubmitVerdictDto.prototype, "verdict", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitVerdictDto.prototype, "penalty", void 0);
//# sourceMappingURL=submit-verdict.dto.js.map