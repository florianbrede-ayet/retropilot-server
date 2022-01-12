import * as yup from 'yup';
import { API_VERSION_NOT_PROVIDED } from '../../consistency/terms';

export const MutateDevice = yup.object().shape({
  version: yup.string().required(API_VERSION_NOT_PROVIDED),
  mutations: {
    nicknake: yup.string().optional(),
    publicKey: yup.string().optional(),
  },
});


export default {

};
