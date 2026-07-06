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
exports.CreateTrialEventDto = exports.TrialEventTypeDto = void 0;
const class_validator_1 = require("class-validator");
var TrialEventTypeDto;
(function (TrialEventTypeDto) {
    TrialEventTypeDto["statement"] = "statement";
    TrialEventTypeDto["evidence_reveal"] = "evidence_reveal";
    TrialEventTypeDto["question"] = "question";
    TrialEventTypeDto["objection"] = "objection";
    TrialEventTypeDto["system"] = "system";
})(TrialEventTypeDto || (exports.TrialEventTypeDto = TrialEventTypeDto = {}));
class CreateTrialEventDto {
}
exports.CreateTrialEventDto = CreateTrialEventDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTrialEventDto.prototype, "actorPlayerId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TrialEventTypeDto),
    __metadata("design:type", String)
], CreateTrialEventDto.prototype, "eventType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTrialEventDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateTrialEventDto.prototype, "metadata", void 0);
//# sourceMappingURL=create-trial-event.dto.js.map