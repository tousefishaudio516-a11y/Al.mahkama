"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrialModule = void 0;
const common_1 = require("@nestjs/common");
const trial_service_1 = require("./trial.service");
const reading_service_1 = require("./reading.service");
const trial_controller_1 = require("./trial.controller");
let TrialModule = class TrialModule {
};
exports.TrialModule = TrialModule;
exports.TrialModule = TrialModule = __decorate([
    (0, common_1.Module)({
        controllers: [trial_controller_1.TrialController],
        providers: [trial_service_1.TrialService, reading_service_1.ReadingService],
        exports: [trial_service_1.TrialService, reading_service_1.ReadingService],
    })
], TrialModule);
//# sourceMappingURL=trial.module.js.map