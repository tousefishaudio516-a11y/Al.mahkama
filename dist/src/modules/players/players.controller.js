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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayersController = void 0;
const common_1 = require("@nestjs/common");
const players_service_1 = require("./players.service");
let PlayersController = class PlayersController {
    constructor(playersService) {
        this.playersService = playersService;
    }
    getMyCharacter(roomCode, playerId) {
        return this.playersService.getMyCharacter(roomCode, playerId);
    }
    getRoomPlayersPublic(roomCode) {
        return this.playersService.getRoomPlayersPublic(roomCode);
    }
};
exports.PlayersController = PlayersController;
__decorate([
    (0, common_1.Get)(':playerId/me'),
    __param(0, (0, common_1.Param)('roomCode')),
    __param(1, (0, common_1.Param)('playerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PlayersController.prototype, "getMyCharacter", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('roomCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlayersController.prototype, "getRoomPlayersPublic", null);
exports.PlayersController = PlayersController = __decorate([
    (0, common_1.Controller)('rooms/:roomCode/players'),
    __metadata("design:paramtypes", [players_service_1.PlayersService])
], PlayersController);
//# sourceMappingURL=players.controller.js.map