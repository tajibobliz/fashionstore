import { Injectable } from '@nestjs/common';


@Injectable()
export class CatalogService {

  findAll() {
    return `This action returns all catalog`;
  }
  findOne(id: number) {
    return `This action returns a #${id} catalog`;
  }
  remove(id: number) {
    return `This action removes a #${id} catalog`;
  }
}
