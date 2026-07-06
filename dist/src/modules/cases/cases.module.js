"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CasesModule = void 0;
const common_1 = require("@nestjs/common");
const cases_service_1 = require("./cases.service");
const cases_controller_1 = require("./cases.controller");
const case_bank_service_1 = require("./bank/case-bank.service");
const case_pattern_service_1 = require("./bank/case-pattern.service");
const players_module_1 = require("../players/players.module");
const trial_module_1 = require("../trial/trial.module");
let CasesModule = class CasesModule {
};
exports.CasesModule = CasesModule;
exports.CasesModule = CasesModule = __decorate([
    (0, common_1.Module)({
        imports: [players_module_1.PlayersModule, trial_module_1.TrialModule],
        controllers: [cases_controller_1.CasesController],
        providers: [cases_service_1.CasesService, case_bank_service_1.CaseBankService, case_pattern_service_1.CasePatternService],
        exports: [cases_service_1.CasesService],
    })
], CasesModule);
//# sourceMappingURL=cases.module.js.map