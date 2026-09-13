import { Injectable } from '@nestjs/common';

@Injectable()
export class InventoryService {
  
  findAll() {
    return `This action returns all inventory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} inventory`;
  }

 
  remove(id: number) {
    return `This action removes a #${id} inventory`;
  }
}
